import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@riskrail/database';

const LIVE = 'rr_live_';
const TEST = 'rr_test_';

/**
 * API keys are shown once and stored only as a peppered SHA-256 hash, so a
 * database leak does not hand out working credentials. The `prefix` column keeps
 * a non-secret fragment so a user can tell their keys apart in the UI.
 */
@Injectable()
export class ApiKeysService {
  private pepper() {
    const value = process.env.API_KEY_PEPPER;
    if (!value || value.length < 32) {
      throw new Error('API_KEY_PEPPER must be set to at least 32 characters');
    }
    return value;
  }

  private hash(token: string) {
    return createHash('sha256').update(`${token}${this.pepper()}`).digest('hex');
  }

  async list(userId: string) {
    const keys = await prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    });
    return { keys };
  }

  /** The only moment the plaintext token exists. */
  async create(userId: string, name: string, live = false) {
    const token = `${live ? LIVE : TEST}${randomBytes(24).toString('hex')}`;
    const record = await prisma.apiKey.create({
      data: {
        userId,
        name,
        prefix: token.slice(0, 16),
        hash: this.hash(token),
      },
      select: { id: true, name: true, prefix: true, createdAt: true },
    });
    return { ...record, token, warning: 'Store this now — it is not shown again.' };
  }

  async revoke(userId: string, id: string) {
    const existing = await prisma.apiKey.findFirst({ where: { id, userId, revokedAt: null } });
    if (!existing) throw new NotFoundException('API key not found');
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return { id, revoked: true };
  }

  /**
   * Resolves a presented token to its owner. Compared in constant time so the
   * lookup cannot be used as an oracle for guessing valid hashes.
   */
  async resolve(token: string): Promise<string | null> {
    if (!token.startsWith(LIVE) && !token.startsWith(TEST)) return null;
    const candidate = this.hash(token);
    const rows = await prisma.apiKey.findMany({
      where: { prefix: token.slice(0, 16), revokedAt: null },
      select: { id: true, userId: true, hash: true },
    });

    for (const row of rows) {
      const a = Buffer.from(row.hash, 'hex');
      const b = Buffer.from(candidate, 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) {
        await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
        return row.userId;
      }
    }
    return null;
  }
}

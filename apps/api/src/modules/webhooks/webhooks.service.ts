import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@rivisk/database';
import { encryptSecret } from '@rivisk/webhooks';

export const WEBHOOK_EVENTS = [
  'portfolio.updated',
  'risk.updated',
  'alert.triggered',
  'policy.breached',
] as const;

/**
 * The signing secret is encrypted at rest rather than hashed, because the
 * delivery worker has to recover it to HMAC each outbound payload. The
 * plaintext is returned once at creation and never again.
 */
@Injectable()
export class WebhooksService {
  async list(userId: string) {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        events: true,
        enabled: true,
        createdAt: true,
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, eventId: true, statusCode: true, attempt: true, deliveredAt: true, createdAt: true },
        },
      },
    });
    return { endpoints };
  }

  async create(userId: string, url: string, events: string[]) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('url must be absolute');
    }
    // Refuse plaintext transport for signed payloads outside local development.
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      throw new BadRequestException('Webhook endpoints must use https');
    }
    const unknown = events.filter((e) => !WEBHOOK_EVENTS.includes(e as never));
    if (unknown.length) {
      throw new BadRequestException(`Unknown events: ${unknown.join(', ')}`);
    }

    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const endpoint = await prisma.webhookEndpoint.create({
      data: { userId, url, events, secretCipher: encryptSecret(secret) },
      select: { id: true, url: true, events: true, enabled: true, createdAt: true },
    });
    return { ...endpoint, secret, warning: 'Store this now — it is not shown again.' };
  }

  async setEnabled(userId: string, id: string, enabled: boolean) {
    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Webhook endpoint not found');
    return prisma.webhookEndpoint.update({
      where: { id },
      data: { enabled },
      select: { id: true, url: true, enabled: true },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await prisma.webhookEndpoint.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Webhook endpoint not found');
    await prisma.webhookEndpoint.delete({ where: { id } });
    return { id, deleted: true };
  }
}

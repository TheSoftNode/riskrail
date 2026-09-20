import { randomBytes } from 'node:crypto';
import {
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma } from '@riskrail/database';
import { createRedisConnection } from '@riskrail/queue';
import { isStacksPrincipal } from '@riskrail/stacks';
import { verifyMessageSignatureRsv } from '@stacks/encryption';
import { publicKeyToAddress } from '@stacks/transactions';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const NONCE_TTL_SECONDS = 300;
const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Wallet-signature login. RiskRail never sees a private key: the browser signs a
 * one-time challenge, and the API checks that the signature came from the public
 * key that hashes to the claimed address.
 *
 * The nonce lives in Redis rather than Postgres so it expires on its own and
 * cannot be replayed — it is deleted the moment it is consumed.
 */
@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly redis = createRedisConnection();

  private secret(): Uint8Array {
    const value = process.env.JWT_SECRET;
    if (!value || value.length < 32) {
      // Refusing to boot on a weak secret is safer than silently signing with one.
      throw new Error('JWT_SECRET must be set to at least 32 characters');
    }
    return new TextEncoder().encode(value);
  }

  private key(address: string) {
    return `riskrail:auth:nonce:${address}`;
  }

  /** Issues the exact string the wallet must sign. */
  async createChallenge(address: string) {
    this.assertAddress(address);
    const nonce = randomBytes(24).toString('hex');
    const issuedAt = new Date().toISOString();
    const domain = process.env.WEB_URL ?? 'http://localhost:3000';

    const message = [
      'RiskRail sign-in',
      '',
      `Domain: ${domain}`,
      `Address: ${address}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
      '',
      'Signing this proves you control the address. It authorises read-only',
      'analytics and alert settings. It does not move funds or approve a',
      'transaction.',
    ].join('\n');

    await this.redis.set(this.key(address), message, 'EX', NONCE_TTL_SECONDS);
    return { address, message, nonce, expiresIn: NONCE_TTL_SECONDS };
  }

  async verify(input: { address: string; publicKey: string; signature: string }) {
    this.assertAddress(input.address);

    const message = await this.redis.get(this.key(input.address));
    if (!message) {
      throw new UnauthorizedException('Challenge expired or was never issued');
    }

    // Bind the signature to the address: a valid signature from some *other*
    // key must not authenticate this account.
    let derived: string;
    try {
      derived = publicKeyToAddress(input.publicKey, this.network());
    } catch {
      throw new UnauthorizedException('Malformed public key');
    }
    if (derived !== input.address) {
      throw new UnauthorizedException('Public key does not match the address');
    }

    const ok = verifyMessageSignatureRsv({
      message,
      signature: input.signature,
      publicKey: input.publicKey,
    });
    if (!ok) throw new UnauthorizedException('Signature did not verify');

    // One challenge, one login.
    await this.redis.del(this.key(input.address));

    const userId = await this.linkWalletToUser(input.address);
    return { userId, address: input.address, ...(await this.issue(userId)) };
  }

  async refresh(refreshToken: string) {
    const payload = await this.decode(refreshToken);
    if (payload.typ !== 'refresh' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Not a refresh token');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.issue(user.id);
  }

  /** Used by the JWT guard. */
  async decode(token: string): Promise<JWTPayload & { typ?: string }> {
    try {
      const { payload } = await jwtVerify(token, this.secret(), {
        issuer: 'riskrail',
        audience: 'riskrail-api',
      });
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * A wallet row may already exist from a public (unauthenticated) scan, in
   * which case we adopt it rather than creating a duplicate.
   */
  private async linkWalletToUser(address: string) {
    const existing = await prisma.wallet.findUnique({ where: { address } });
    if (existing?.userId) return existing.userId;

    const user = await prisma.user.create({ data: {} });
    await prisma.wallet.upsert({
      where: { address },
      update: { userId: user.id },
      create: { address, userId: user.id },
    });
    return user.id;
  }

  private async issue(userId: string): Promise<AuthTokens> {
    const base = () =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuer('riskrail')
        .setAudience('riskrail-api')
        .setIssuedAt();

    const accessToken = await base()
      .setExpirationTime(ACCESS_TTL)
      .sign(this.secret());
    const refreshToken = await new SignJWT({ typ: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('riskrail')
      .setAudience('riskrail-api')
      .setIssuedAt()
      .setExpirationTime(REFRESH_TTL)
      .sign(this.secret());

    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }

  private network(): 'mainnet' | 'testnet' {
    return process.env.STACKS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  }

  private assertAddress(address: string) {
    if (!isStacksPrincipal(address)) {
      throw new UnauthorizedException('A valid Stacks principal is required');
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

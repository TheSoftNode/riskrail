import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Webhook signing secrets must be recoverable — the delivery worker HMACs every
 * outbound payload with them — so they are encrypted at rest rather than hashed.
 * API keys keep the one-way hash, because those only ever need comparison.
 */

const ALGO = 'aes-256-gcm';
const SALT = 'riskrail.webhooks.v1';

function key(): Buffer {
  const material = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!material || material.length < 32) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY must be set to at least 32 characters');
  }
  return scryptSync(material, SALT, 32);
}

/** Returns `iv.tag.ciphertext`, all base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split('.');
  if (!iv || !tag || !data) throw new Error('Malformed webhook secret');
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Stripe-style signature header: `t=<unix>,v1=<hex hmac>`.
 *
 * The timestamp is inside the signed material, so an attacker cannot replay an
 * old body under a fresh timestamp.
 */
export function signPayload(
  body: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const mac = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

/** For receivers and for our own tests. Rejects signatures older than `toleranceSeconds`. */
export function verifySignature(
  body: string,
  header: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim() ?? '', v?.trim() ?? ''];
    }),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest();
  const given = Buffer.from(parts.v1, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface WebhookEvent {
  id: string;
  type: 'portfolio.updated' | 'risk.updated' | 'alert.triggered' | 'policy.breached';
  address: string;
  createdAt: string;
  data: Record<string, unknown>;
}

/** Retry schedule in seconds; delivery stops after the last entry. */
export const RETRY_BACKOFF_SECONDS = [30, 120, 600, 3600];

/** Builds the envelope delivered to subscribers. */
export function buildEvent(
  type: WebhookEvent['type'],
  address: string,
  data: Record<string, unknown>,
): WebhookEvent {
  return {
    id: randomUUID(),
    type,
    address,
    createdAt: new Date().toISOString(),
    data,
  };
}

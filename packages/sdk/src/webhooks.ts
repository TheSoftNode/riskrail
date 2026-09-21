import { RiviskError } from './errors.js';
import type { WebhookEvent } from './types.js';

/**
 * Verifying webhook deliveries.
 *
 * Built on WebCrypto rather than `node:crypto` so the same code runs in Node,
 * a browser, Deno, Bun and edge runtimes. That matters because webhook
 * receivers are exactly the thing people deploy to serverless platforms.
 *
 * The header is `rivisk-signature: t=<unix>,v1=<hex hmac>`, and the signed
 * material is `${t}.${rawBody}` -- the timestamp is inside the signature, so an
 * old body cannot be replayed under a fresh timestamp.
 */

export const SIGNATURE_HEADER = 'rivisk-signature';
export const EVENT_ID_HEADER = 'rivisk-event-id';
export const EVENT_TYPE_HEADER = 'rivisk-event-type';
export const DELIVERY_ATTEMPT_HEADER = 'rivisk-delivery-attempt';

/** Default replay window, matching the sender. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export interface ParsedSignature {
  timestamp: number;
  signature: string;
}

export function parseSignatureHeader(header: string): ParsedSignature | null {
  const parts: Record<string, string> = {};
  for (const pair of header.split(',')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    parts[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
  }
  const timestamp = Number(parts['t']);
  const signature = parts['v1'];
  if (!Number.isFinite(timestamp) || !signature) return null;
  return { timestamp, signature };
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Length-independent, and constant time for equal lengths. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function subtle(): SubtleCrypto {
  const value = globalThis.crypto?.subtle;
  if (!value) {
    throw new RiviskError(
      'WebCrypto is unavailable. Node 18+, a browser, or an edge runtime is required to verify webhook signatures.',
      { status: 0 },
    );
  }
  return value;
}

async function hmac(secret: string, material: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await subtle().importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await subtle().sign('HMAC', key, encoder.encode(material)));
}

export interface VerifyOptions {
  /** How far out of date a delivery may be. Set 0 to disable the check. */
  toleranceSeconds?: number;
  /** Injectable for tests. */
  now?: () => number;
}

/**
 * True when `header` is a valid signature over `rawBody` for `secret`.
 *
 * `rawBody` must be the exact bytes received. Parsing JSON and re-stringifying
 * changes key order and whitespace, and the signature will not match -- this is
 * the single most common webhook integration mistake.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  options: VerifyOptions = {},
): Promise<boolean> {
  if (!header) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (tolerance > 0) {
    const now = Math.floor((options.now?.() ?? Date.now()) / 1000);
    if (Math.abs(now - parsed.timestamp) > tolerance) return false;
  }

  const given = hexToBytes(parsed.signature);
  if (!given) return false;
  const expected = await hmac(secret, `${parsed.timestamp}.${rawBody}`);
  return timingSafeEqual(expected, given);
}

/**
 * Verifies and parses in one step, throwing when the signature does not hold.
 *
 * This is the function to reach for in a route handler: it makes the failure
 * path explicit, so an unverified body cannot be used by accident.
 */
export async function constructWebhookEvent(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  options: VerifyOptions = {},
): Promise<WebhookEvent> {
  const valid = await verifyWebhookSignature(rawBody, header, secret, options);
  if (!valid) {
    throw new RiviskError('Webhook signature verification failed', { status: 400 });
  }
  try {
    return JSON.parse(rawBody) as WebhookEvent;
  } catch (cause) {
    throw new RiviskError('Webhook body is not valid JSON', { status: 400, cause });
  }
}

/** Signing, for tests and for anyone building a fake sender against the SDK. */
export async function signWebhookPayload(
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): Promise<string> {
  const mac = await hmac(secret, `${timestamp}.${rawBody}`);
  const hex = Array.from(mac, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

import { beforeAll, describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  signPayload,
  verifySignature,
} from './index.js';

beforeAll(() => {
  process.env.WEBHOOK_ENCRYPTION_KEY = 'test-key-that-is-at-least-32-chars-long';
});

describe('secret storage', () => {
  it('round-trips a secret', () => {
    const secret = 'whsec_0123456789abcdef';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time', () => {
    const secret = 'whsec_same-input';
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  it('rejects a tampered ciphertext', () => {
    const stored = encryptSecret('whsec_abc');
    const [iv, tag, data] = stored.split('.');
    const flipped = Buffer.from(data!, 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() =>
      decryptSecret([iv, tag, flipped.toString('base64url')].join('.')),
    ).toThrow();
  });
});

describe('payload signing', () => {
  const body = JSON.stringify({ type: 'risk.updated', address: 'SP2ABC' });
  const secret = 'whsec_signing';

  it('verifies its own signature', () => {
    expect(verifySignature(body, signPayload(body, secret), secret)).toBe(true);
  });

  it('rejects a different secret', () => {
    expect(verifySignature(body, signPayload(body, secret), 'whsec_other')).toBe(false);
  });

  it('rejects a modified body', () => {
    const header = signPayload(body, secret);
    expect(verifySignature(body + ' ', header, secret)).toBe(false);
  });

  it('rejects a replayed signature outside the tolerance window', () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(verifySignature(body, signPayload(body, secret, old), secret)).toBe(false);
  });
});

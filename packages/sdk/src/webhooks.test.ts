import { describe, expect, it } from 'vitest';
import {
  constructWebhookEvent,
  parseSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
} from './webhooks.js';

const SECRET = 'whsec_2f8a1c4e6b0d';
const BODY = JSON.stringify({
  id: 'evt_1',
  type: 'risk.updated',
  address: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
  createdAt: '2026-09-20T12:00:00.000Z',
  data: { healthFactorE4: 12700 },
});

describe('parseSignatureHeader', () => {
  it('reads the timestamp and signature', () => {
    expect(parseSignatureHeader('t=1758000000,v1=abcdef')).toEqual({
      timestamp: 1758000000,
      signature: 'abcdef',
    });
  });

  it('tolerates whitespace', () => {
    expect(parseSignatureHeader(' t=1 , v1=ff ')?.signature).toBe('ff');
  });

  it('is null when a part is missing or malformed', () => {
    expect(parseSignatureHeader('v1=abc')).toBeNull();
    expect(parseSignatureHeader('t=notanumber,v1=abc')).toBeNull();
    expect(parseSignatureHeader('garbage')).toBeNull();
  });
});

describe('verifyWebhookSignature', () => {
  it('accepts a signature it just produced', async () => {
    const header = await signWebhookPayload(BODY, SECRET);
    await expect(verifyWebhookSignature(BODY, header, SECRET)).resolves.toBe(true);
  });

  it('rejects a tampered body', async () => {
    const header = await signWebhookPayload(BODY, SECRET);
    const tampered = BODY.replace('12700', '19999');
    await expect(verifyWebhookSignature(tampered, header, SECRET)).resolves.toBe(false);
  });

  it('rejects the wrong secret', async () => {
    const header = await signWebhookPayload(BODY, SECRET);
    await expect(verifyWebhookSignature(BODY, header, 'whsec_other')).resolves.toBe(false);
  });

  /**
   * The timestamp is inside the signed material, so moving it invalidates the
   * signature. Without that, an old body could be replayed under a fresh `t`.
   */
  it('rejects a replay that swaps in a fresh timestamp', async () => {
    const header = await signWebhookPayload(BODY, SECRET, 1_700_000_000);
    const now = Math.floor(Date.now() / 1000);
    const replayed = header.replace(/^t=\d+/, `t=${now}`);
    await expect(verifyWebhookSignature(BODY, replayed, SECRET)).resolves.toBe(false);
  });

  it('rejects a delivery older than the tolerance', async () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const header = await signWebhookPayload(BODY, SECRET, old);
    await expect(verifyWebhookSignature(BODY, header, SECRET)).resolves.toBe(false);
    // ...and accepts it when the window is opened wide enough.
    await expect(
      verifyWebhookSignature(BODY, header, SECRET, { toleranceSeconds: 7200 }),
    ).resolves.toBe(true);
  });

  it('can disable the replay window entirely', async () => {
    const header = await signWebhookPayload(BODY, SECRET, 1_000_000);
    await expect(
      verifyWebhookSignature(BODY, header, SECRET, { toleranceSeconds: 0 }),
    ).resolves.toBe(true);
  });

  it('rejects a missing or junk header instead of throwing', async () => {
    await expect(verifyWebhookSignature(BODY, null, SECRET)).resolves.toBe(false);
    await expect(verifyWebhookSignature(BODY, undefined, SECRET)).resolves.toBe(false);
    await expect(verifyWebhookSignature(BODY, 'nonsense', SECRET)).resolves.toBe(false);
    await expect(verifyWebhookSignature(BODY, 't=1,v1=zzzz', SECRET)).resolves.toBe(false);
  });

  /**
   * The mistake every webhook integration makes once: parsing the body and
   * re-stringifying changes key order and whitespace, so the bytes no longer
   * match what was signed.
   */
  it('fails when the body was re-serialised rather than kept raw', async () => {
    const header = await signWebhookPayload(BODY, SECRET);
    const reserialised = JSON.stringify(JSON.parse(BODY), null, 2);
    await expect(verifyWebhookSignature(reserialised, header, SECRET)).resolves.toBe(false);
  });
});

describe('constructWebhookEvent', () => {
  it('returns the parsed event when the signature holds', async () => {
    const header = await signWebhookPayload(BODY, SECRET);
    const event = await constructWebhookEvent(BODY, header, SECRET);
    expect(event.type).toBe('risk.updated');
    expect(event.data).toEqual({ healthFactorE4: 12700 });
  });

  it('throws rather than returning an unverified body', async () => {
    await expect(constructWebhookEvent(BODY, 't=1,v1=ff', SECRET)).rejects.toThrowError(
      /signature verification failed/i,
    );
  });

  it('throws on a verified but unparseable body', async () => {
    const body = 'not json';
    const header = await signWebhookPayload(body, SECRET);
    await expect(constructWebhookEvent(body, header, SECRET)).rejects.toThrowError(/not valid JSON/);
  });
});

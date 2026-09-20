import { describe, expect, it } from 'vitest';
import { classify } from './webhook-delivery.js';

describe('delivery classification', () => {
  it('treats any 2xx as delivered', () => {
    for (const status of [200, 201, 202, 204, 299]) {
      expect(classify(status)).toBe('ok');
    }
  });

  it('retries throttling and timeouts', () => {
    expect(classify(408)).toBe('retry');
    expect(classify(429)).toBe('retry');
  });

  it('drops permanent client errors rather than burning attempts', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(classify(status)).toBe('drop');
    }
  });

  it('retries server errors', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classify(status)).toBe('retry');
    }
  });
});

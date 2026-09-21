import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, DEFAULT_RETRY, HttpClient, parseRetryAfter } from './http.js';
import { RiviskNetworkError, RiviskRateLimitError, RiviskTimeoutError } from './errors.js';

const BASE = 'https://api.example.com/api/v1';
const fast = { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2 };

describe('parseRetryAfter', () => {
  it('reads a seconds value', () => {
    expect(parseRetryAfter('30')).toBe(30);
  });

  it('reads an HTTP date and converts to seconds from now', () => {
    const soon = new Date(Date.now() + 20_000).toUTCString();
    const seconds = parseRetryAfter(soon) ?? 0;
    expect(seconds).toBeGreaterThan(15);
    expect(seconds).toBeLessThanOrEqual(21);
  });

  it('is undefined for junk or a missing header', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('soon please')).toBeUndefined();
  });
});

describe('backoffDelay', () => {
  it('grows exponentially and is capped', () => {
    const full = () => 1; // full jitter at its maximum
    expect(backoffDelay(0, DEFAULT_RETRY, full)).toBe(300);
    expect(backoffDelay(1, DEFAULT_RETRY, full)).toBe(600);
    expect(backoffDelay(2, DEFAULT_RETRY, full)).toBe(1200);
    expect(backoffDelay(20, DEFAULT_RETRY, full)).toBe(DEFAULT_RETRY.maxDelayMs);
  });

  it('jitters between zero and the ceiling', () => {
    expect(backoffDelay(3, DEFAULT_RETRY, () => 0)).toBe(0);
  });
});

function sequence(responses: Array<() => Response | Promise<Response>>) {
  let i = 0;
  const fetchImpl = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)]!;
    i++;
    return next();
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, count: () => i };
}

const ok = (body: unknown = { ok: true }) => () =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const status = (code: number, headers: Record<string, string> = {}) => () =>
  new Response(JSON.stringify({ message: `status ${code}` }), { status: code, headers });

describe('retries', () => {
  it('retries a GET through 5xx and returns the eventual success', async () => {
    const { fetchImpl, count } = sequence([status(503), status(503), ok({ value: 1 })]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: fast });
    await expect(http.get('/x')).resolves.toEqual({ value: 1 });
    expect(count()).toBe(3);
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const { fetchImpl, count } = sequence([status(500)]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: { ...fast, maxRetries: 2 } });
    await expect(http.get('/x')).rejects.toMatchObject({ status: 500 });
    expect(count()).toBe(3); // first attempt plus two retries
  });

  it('does not retry a 4xx that will never succeed', async () => {
    const { fetchImpl, count } = sequence([status(404)]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: fast });
    await expect(http.get('/x')).rejects.toMatchObject({ status: 404 });
    expect(count()).toBe(1);
  });

  it('does not retry a non-idempotent POST on 5xx', async () => {
    // The server may have created the resource before failing, so repeating it
    // could duplicate a webhook endpoint or an API key.
    const { fetchImpl, count } = sequence([status(500)]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: fast });
    await expect(http.post('/webhooks', {})).rejects.toMatchObject({ status: 500 });
    expect(count()).toBe(1);
  });

  it('does retry a POST on 429, which was never processed', async () => {
    const { fetchImpl, count } = sequence([status(429), ok()]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: fast });
    await expect(http.post('/webhooks', {})).resolves.toEqual({ ok: true });
    expect(count()).toBe(2);
  });

  it('retries a POST that opts in as idempotent', async () => {
    const { fetchImpl, count } = sequence([status(503), ok()]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: fast });
    await expect(http.post('/simulations', {}, { idempotent: true })).resolves.toEqual({ ok: true });
    expect(count()).toBe(2);
  });

  it('retries a network failure', async () => {
    let i = 0;
    const fetchImpl = vi.fn(async () => {
      if (i++ === 0) throw new TypeError('fetch failed');
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: fast });
    await expect(http.get('/x')).resolves.toEqual({});
  });

  it('wraps an unreachable host as RiviskNetworkError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: false });
    await expect(http.get('/x')).rejects.toThrowError(RiviskNetworkError);
  });

  it('honours Retry-After instead of its own backoff', async () => {
    const { fetchImpl } = sequence([status(429, { 'retry-after': '0' }), ok()]);
    const seen: number[] = [];
    const http = new HttpClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      retry: { maxRetries: 2, baseDelayMs: 50_000, maxDelayMs: 60_000 },
      onRetry: (info) => seen.push(info.delayMs),
    });
    await expect(http.get('/x')).resolves.toEqual({ ok: true });
    // Without Retry-After this would have waited tens of seconds.
    expect(seen).toEqual([0]);
  });

  it('exposes retryAfterSeconds on the rate limit error', async () => {
    const { fetchImpl } = sequence([status(429, { 'retry-after': '42' })]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: false });
    const error = await http.get('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RiviskRateLimitError);
    expect((error as RiviskRateLimitError).retryAfterSeconds).toBe(42);
  });

  it('can be disabled entirely', async () => {
    const { fetchImpl, count } = sequence([status(503)]);
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: false });
    await expect(http.get('/x')).rejects.toMatchObject({ status: 503 });
    expect(count()).toBe(1);
  });
});

describe('timeouts and cancellation', () => {
  it('aborts a hanging request and reports a timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init: RequestInit = {}) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    ) as unknown as typeof fetch;
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, timeoutMs: 10, retry: false });
    await expect(http.get('/x')).rejects.toThrowError(RiviskTimeoutError);
  });

  it("respects the caller's own abort signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: unknown, init: RequestInit = {}) =>
        new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          if (init.signal?.aborted) fail();
          init.signal?.addEventListener('abort', fail);
        }),
    ) as unknown as typeof fetch;
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl, retry: false });
    const promise = http.get('/x', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrowError(RiviskTimeoutError);
  });
});

describe('request shape', () => {
  it('appends query parameters and drops undefined ones', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl });
    await http.get('/x', { query: { limit: 10, cursor: undefined, live: true } });
    expect(calls[0]).toBe(`${BASE}/x?limit=10&live=true`);
  });

  it('only sets content-type when there is a body', async () => {
    const headers: Array<Record<string, string>> = [];
    const fetchImpl = vi.fn(async (_url: unknown, init: RequestInit = {}) => {
      headers.push(init.headers as Record<string, string>);
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl });
    await http.get('/x');
    await http.post('/x', { a: 1 });
    expect(headers[0]?.['content-type']).toBeUndefined();
    expect(headers[1]?.['content-type']).toBe('application/json');
  });

  it('merges custom headers from the client and the call', async () => {
    const headers: Array<Record<string, string>> = [];
    const fetchImpl = vi.fn(async (_url: unknown, init: RequestInit = {}) => {
      headers.push(init.headers as Record<string, string>);
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const http = new HttpClient({
      baseUrl: BASE,
      fetch: fetchImpl,
      headers: { 'x-client': 'agent' },
    });
    await http.get('/x', { headers: { 'x-trace': 'abc' } });
    expect(headers[0]?.['x-client']).toBe('agent');
    expect(headers[0]?.['x-trace']).toBe('abc');
  });

  it('returns undefined for an empty 204 body rather than throwing', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const http = new HttpClient({ baseUrl: BASE, fetch: fetchImpl });
    await expect(http.delete('/x')).resolves.toBeUndefined();
  });
});

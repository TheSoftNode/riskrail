import { describe, expect, it, vi } from 'vitest';
import { RiviskClient } from './client.js';
import { RiviskAuthError, RiviskError } from './errors.js';

/** A fetch double that records calls and replays queued responses. */
function stubFetch(
  responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const queue = [...responses];
  const impl = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = queue.shift() ?? { status: 200, body: {} };
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { 'content-type': 'application/json', ...next.headers },
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const BASE = 'https://api.example.com/api/v1';
const ADDR = 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7';

describe('request construction', () => {
  it('builds namespaced URLs against the configured base', async () => {
    const { impl, calls } = stubFetch([{ body: { address: ADDR } }]);
    await new RiviskClient({ baseUrl: BASE, fetch: impl }).portfolios.risk(ADDR);
    expect(calls[0]?.url).toBe(`${BASE}/portfolios/${ADDR}/risk`);
  });

  it('strips trailing slashes from the base url', async () => {
    const { impl, calls } = stubFetch([{ body: {} }]);
    await new RiviskClient({ baseUrl: `${BASE}///`, fetch: impl }).health();
    expect(calls[0]?.url).toBe(`${BASE}/health`);
  });

  it('percent-encodes the address into the path', async () => {
    const { impl, calls } = stubFetch([{ body: {} }]);
    await new RiviskClient({ baseUrl: BASE, fetch: impl }).portfolios.get('SP1/../admin');
    expect(calls[0]?.url).toBe(`${BASE}/portfolios/SP1%2F..%2Fadmin`);
  });

  it('sends the api key as a bearer token, and omits the header without one', async () => {
    const withKey = stubFetch([{ body: {} }]);
    await new RiviskClient({ baseUrl: BASE, fetch: withKey.impl, apiKey: 'rv_test_x' }).health();
    expect((withKey.calls[0]?.init.headers as Record<string, string>).authorization).toBe(
      'Bearer rv_test_x',
    );

    const without = stubFetch([{ body: {} }]);
    await new RiviskClient({ baseUrl: BASE, fetch: without.impl }).health();
    expect((without.calls[0]?.init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('posts simulation shocks with the address in the body', async () => {
    const { impl, calls } = stubFetch([{ body: {} }]);
    await new RiviskClient({ baseUrl: BASE, fetch: impl }).simulations.run(ADDR, {
      name: 'BTC -20%',
      shocks: [{ symbol: 'sBTC', changeBps: -2000 }],
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      address: ADDR,
      name: 'BTC -20%',
      shocks: [{ symbol: 'sBTC', changeBps: -2000 }],
    });
  });

  it('sends alert rules on the in_app channel, the only one the API accepts', async () => {
    const { impl, calls } = stubFetch([{ body: {} }]);
    await new RiviskClient({ baseUrl: BASE, fetch: impl }).alerts.create(ADDR, {
      metric: 'healthFactorE4',
      operator: 'lt',
      threshold: '13000',
    });
    expect(JSON.parse(String(calls[0]?.init.body)).channel).toBe('in_app');
  });

  it('exposes status shorthands that map to the right value', async () => {
    const { impl, calls } = stubFetch([{ body: {} }, { body: {} }, { body: {} }]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl });
    await rr.alerts.pause('r1');
    await rr.alerts.resume('r1');
    await rr.alerts.archive('r1');
    expect(calls.map((c) => JSON.parse(String(c.init.body)).status)).toEqual([
      'PAUSED',
      'ACTIVE',
      'ARCHIVED',
    ]);
  });

  it('keeps the pre-namespace shorthand working', async () => {
    const { impl, calls } = stubFetch([{ body: {} }, { body: {} }]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl });
    await rr.portfolio(ADDR);
    await rr.risk(ADDR);
    expect(calls.map((c) => c.url)).toEqual([
      `${BASE}/portfolios/${ADDR}`,
      `${BASE}/portfolios/${ADDR}/risk`,
    ]);
  });
});

describe('errors', () => {
  it('raises RiviskError carrying the status and body', async () => {
    const { impl } = stubFetch([
      { status: 404, body: { message: 'Wallet not found' } },
      { status: 404, body: { message: 'Wallet not found' } },
    ]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, retry: false });
    await expect(rr.portfolios.get(ADDR)).rejects.toThrowError(RiviskError);
    await expect(rr.portfolios.get(ADDR)).rejects.toMatchObject({
      status: 404,
      message: 'Wallet not found',
    });
  });

  it('joins array validation messages from class-validator', async () => {
    const { impl } = stubFetch([
      { status: 400, body: { message: ['address must be a Stacks principal', 'nope'] } },
    ]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, retry: false });
    await expect(rr.portfolios.get('x')).rejects.toThrowError(
      'address must be a Stacks principal, nope',
    );
  });

  it('raises RiviskAuthError on 401 and 403', async () => {
    for (const status of [401, 403]) {
      const { impl } = stubFetch([{ status, body: { message: 'nope' } }]);
      const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, retry: false });
      await expect(rr.apiKeys.list()).rejects.toThrowError(RiviskAuthError);
    }
  });

  it('surfaces a non-JSON error body rather than swallowing it', async () => {
    const impl = vi.fn(async () => new Response('<html>502</html>', { status: 502 })) as unknown as typeof fetch;
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, retry: false });
    await expect(rr.health()).rejects.toMatchObject({ status: 502, body: '<html>502</html>' });
  });
});

describe('wallet sessions', () => {
  const session = {
    userId: 'u1',
    address: ADDR,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresIn: 900,
  };

  it('prefers the session token over a static api key', async () => {
    const { impl, calls } = stubFetch([{ body: {} }]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, apiKey: 'rv_test_x', session });
    await rr.auth.me();
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(
      'Bearer access-1',
    );
  });

  it('stores the session returned by verify and reports it back', async () => {
    const seen: unknown[] = [];
    const { impl } = stubFetch([{ body: session }]);
    const rr = new RiviskClient({
      baseUrl: BASE,
      fetch: impl,
      onSession: (s) => seen.push(s),
    });
    await rr.auth.verify({ address: ADDR, publicKey: '02'.repeat(33), signature: 'ab'.repeat(65) });
    expect(rr.getSession()?.accessToken).toBe('access-1');
    expect(seen).toEqual([session]);
  });

  it('refreshes once on a 401 and replays the original request', async () => {
    const { impl, calls } = stubFetch([
      { status: 401, body: { message: 'expired' } },
      { body: { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 } },
      { body: { userId: 'u1' } },
    ]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, session, retry: false });

    await expect(rr.auth.me()).resolves.toEqual({ userId: 'u1' });
    expect(calls.map((c) => c.url)).toEqual([
      `${BASE}/auth/me`,
      `${BASE}/auth/refresh`,
      `${BASE}/auth/me`,
    ]);
    // The replay carries the new token, not the stale one.
    expect((calls[2]?.init.headers as Record<string, string>).authorization).toBe(
      'Bearer access-2',
    );
    expect(rr.getSession()?.accessToken).toBe('access-2');
  });

  it('gives up and clears the session when the refresh token is also dead', async () => {
    const cleared: unknown[] = [];
    const { impl } = stubFetch([
      { status: 401, body: { message: 'expired' } },
      { status: 401, body: { message: 'refresh rejected' } },
    ]);
    const rr = new RiviskClient({
      baseUrl: BASE,
      fetch: impl,
      session,
      retry: false,
      onSession: (s) => cleared.push(s),
    });

    await expect(rr.auth.me()).rejects.toThrowError(RiviskAuthError);
    expect(rr.getSession()).toBeNull();
    expect(cleared).toEqual([null]);
  });

  it('does not attempt a refresh when there is no session', async () => {
    const { impl, calls } = stubFetch([{ status: 401, body: { message: 'no' } }]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, retry: false });
    await expect(rr.apiKeys.list()).rejects.toThrowError(RiviskAuthError);
    expect(calls).toHaveLength(1);
  });

  it('signOut drops the session and stops sending the token', async () => {
    const { impl, calls } = stubFetch([{ body: {} }]);
    const rr = new RiviskClient({ baseUrl: BASE, fetch: impl, session });
    rr.auth.signOut();
    await rr.health();
    expect(rr.getSession()).toBeNull();
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBeUndefined();
  });
});

describe('realtime wiring', () => {
  it('explains what is missing rather than failing obscurely', () => {
    const rr = new RiviskClient({ baseUrl: BASE });
    expect(() => rr.realtime).toThrowError(/realtimeUrl/);
  });
});

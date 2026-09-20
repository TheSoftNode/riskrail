import { describe, expect, it } from 'vitest';
import { RiskRailClient, RiskRailError } from './index.js';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function stub(status = 200, payload: unknown = { ok: true }) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: 'stub',
      text: async () => JSON.stringify(payload),
    } as Response;
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('RiskRailClient', () => {
  it('builds namespaced URLs against the configured base', async () => {
    const { calls, fetchImpl } = stub();
    const rr = new RiskRailClient({ baseUrl: 'https://api.example.com/api/v1', fetchImpl });

    await rr.portfolios.risk('SP2ABC');
    await rr.simulations.presets();
    await rr.policies.get('SP2ABC');

    expect(calls.map((c) => c.url)).toEqual([
      'https://api.example.com/api/v1/portfolios/SP2ABC/risk',
      'https://api.example.com/api/v1/simulations/presets',
      'https://api.example.com/api/v1/policies/SP2ABC',
    ]);
  });

  it('strips a trailing slash from the base url', async () => {
    const { calls, fetchImpl } = stub();
    await new RiskRailClient({ baseUrl: 'https://api.example.com/api/v1/', fetchImpl }).health();
    expect(calls[0]!.url).toBe('https://api.example.com/api/v1/health');
  });

  it('sends the api key as a bearer token only when provided', async () => {
    const withKey = stub();
    await new RiskRailClient({ apiKey: 'rr_test_abc', fetchImpl: withKey.fetchImpl }).health();
    expect(withKey.calls[0]!.headers.authorization).toBe('Bearer rr_test_abc');

    const without = stub();
    await new RiskRailClient({ fetchImpl: without.fetchImpl }).health();
    expect(without.calls[0]!.headers.authorization).toBeUndefined();
  });

  it('encodes addresses into the path', async () => {
    const { calls, fetchImpl } = stub();
    await new RiskRailClient({ fetchImpl }).portfolios.get('SP2/ABC');
    expect(calls[0]!.url).toContain('SP2%2FABC');
  });

  it('posts simulation shocks with the address in the body', async () => {
    const { calls, fetchImpl } = stub();
    await new RiskRailClient({ fetchImpl }).simulations.run('SP2ABC', {
      name: 'BTC -20%',
      shocks: [{ symbol: 'sBTC', changeBps: -2000 }],
    });
    expect(calls[0]!.method).toBe('POST');
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      address: 'SP2ABC',
      name: 'BTC -20%',
      shocks: [{ symbol: 'sBTC', changeBps: -2000 }],
    });
  });

  it('defaults alert rules to the in_app channel', async () => {
    const { calls, fetchImpl } = stub();
    await new RiskRailClient({ fetchImpl }).alerts.create('SP2ABC', {
      metric: 'healthFactorE4',
      operator: 'lt',
      threshold: '13000',
    });
    expect(JSON.parse(calls[0]!.body!).channel).toBe('in_app');
  });

  it('raises RiskRailError carrying the status and body', async () => {
    const { fetchImpl } = stub(404, { message: 'Wallet has not been indexed yet' });
    await expect(
      new RiskRailClient({ fetchImpl }).portfolios.risk('SP2ABC'),
    ).rejects.toMatchObject({
      name: 'RiskRailError',
      status: 404,
      message: 'Wallet has not been indexed yet',
    });
  });

  it('joins array validation messages', async () => {
    const { fetchImpl } = stub(400, { message: ['url must be absolute', 'events required'] });
    await expect(
      new RiskRailClient({ fetchImpl }).webhooks.create('nope', ['risk.updated']),
    ).rejects.toThrow('url must be absolute, events required');
  });

  it('keeps the pre-namespace shorthand working', async () => {
    const { calls, fetchImpl } = stub();
    const rr = new RiskRailClient({ fetchImpl });
    await rr.risk('SP2ABC');
    expect(calls[0]!.url).toContain('/portfolios/SP2ABC/risk');
    expect(RiskRailError).toBeDefined();
  });
});

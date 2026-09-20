export interface RiskRailClientOptions {
  /** Defaults to the local API. Point this at your deployment. */
  baseUrl?: string;
  /** An `rr_live_` or `rr_test_` key, or a user access token. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface PriceShock {
  symbol?: string;
  assetId?: string;
  /** Basis points. -2000 is a 20% fall. */
  changeBps: number;
}

export type AlertMetric =
  | 'riskScoreBps'
  | 'healthFactorE4'
  | 'liquidationDistanceBps'
  | 'protocolConcentrationBps'
  | 'assetConcentrationBps'
  | 'liquidityScoreBps'
  | 'capitalAccessibilityBps';

export type AlertOperator = 'lt' | 'lte' | 'gt' | 'gte';

export type WebhookEventType =
  | 'portfolio.updated'
  | 'risk.updated'
  | 'alert.triggered'
  | 'policy.breached';

export class RiskRailError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'RiskRailError';
  }
}

/**
 * Typed client for the RiskRail API.
 *
 * Every read is scoped to a public Stacks address and needs no credentials.
 * Writes (alerts, webhooks, keys) require an API key or access token.
 */
export class RiskRailClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RiskRailClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    const body = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      const message =
        (body as { message?: string | string[] } | undefined)?.message ??
        `${response.status} ${response.statusText}`;
      throw new RiskRailError(
        Array.isArray(message) ? message.join(', ') : message,
        response.status,
        body,
      );
    }
    return body as T;
  }

  private get<T>(path: string) {
    return this.request<T>(path);
  }

  private send<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
    return this.request<T>(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  private static addr(address: string) {
    return encodeURIComponent(address);
  }

  health() {
    return this.get<{ status: string }>('/health');
  }

  readonly portfolios = {
    get: (address: string) =>
      this.get(`/portfolios/${RiskRailClient.addr(address)}`),
    risk: (address: string) =>
      this.get(`/portfolios/${RiskRailClient.addr(address)}/risk`),
    refresh: (address: string) =>
      this.send<{ accepted: boolean; correlationId: string }>(
        'POST',
        `/portfolios/${RiskRailClient.addr(address)}/refresh`,
      ),
  };

  readonly simulations = {
    presets: () => this.get<Array<{ id?: string; name?: string; shocks: PriceShock[] }>>(
      '/simulations/presets',
    ),
    run: (address: string, input: { name?: string; shocks: PriceShock[] }) =>
      this.send('POST', '/simulations', { address, ...input }),
  };

  readonly alerts = {
    list: (address: string) => this.get(`/alerts/${RiskRailClient.addr(address)}`),
    create: (
      address: string,
      input: { metric: AlertMetric; operator: AlertOperator; threshold: string },
    ) =>
      this.send('POST', `/alerts/${RiskRailClient.addr(address)}`, {
        ...input,
        channel: 'in_app',
      }),
    setStatus: (id: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') =>
      this.send('PATCH', `/alerts/${encodeURIComponent(id)}`, { status }),
  };

  readonly policies = {
    get: (address: string) => this.get(`/policies/${RiskRailClient.addr(address)}`),
  };

  readonly webhooks = {
    list: () => this.get('/webhooks'),
    /** The signing secret is returned once and never again. */
    create: (url: string, events: WebhookEventType[]) =>
      this.send<{ id: string; url: string; secret: string }>('POST', '/webhooks', {
        url,
        events,
      }),
    setEnabled: (id: string, enabled: boolean) =>
      this.send('PATCH', `/webhooks/${encodeURIComponent(id)}`, { enabled }),
    remove: (id: string) => this.send('DELETE', `/webhooks/${encodeURIComponent(id)}`),
  };

  readonly apiKeys = {
    list: () => this.get('/api-keys'),
    /** The token is returned once and never again. */
    create: (name: string, live = false) =>
      this.send<{ id: string; token: string }>('POST', '/api-keys', { name, live }),
    revoke: (id: string) => this.send('DELETE', `/api-keys/${encodeURIComponent(id)}`),
  };

  /** Kept for the shorthand the docs used before the namespaces landed. */
  portfolio(address: string) {
    return this.portfolios.get(address);
  }

  risk(address: string) {
    return this.portfolios.risk(address);
  }
}

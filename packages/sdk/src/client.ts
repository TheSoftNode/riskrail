import { RiviskAuthError } from './errors.js';
import { HttpClient, type HttpOptions, type RequestOptions } from './http.js';
import { RealtimeClient, type RealtimeOptions } from './realtime.js';
import type {
  AlertMetric,
  AlertOperator,
  AlertsResponse,
  AlertRule,
  ApiKey,
  ApiKeyCreated,
  AuthChallenge,
  AuthSession,
  AuthTokens,
  PolicyResponse,
  PortfolioResponse,
  PriceShock,
  Profile,
  RefreshAccepted,
  RiskResponse,
  SimulationPreset,
  SimulationResponse,
  WebhookCreated,
  WebhookEndpoint,
  WebhookEventType,
} from './types.js';

export interface RiviskClientOptions
  extends Omit<HttpOptions, 'baseUrl' | 'getAuthToken' | 'onUnauthorized'> {
  /** API origin including the version prefix. Defaults to the local API. */
  baseUrl?: string;
  /** Restore a session from storage so the client starts authenticated. */
  session?: AuthSession | null;
  /** Called whenever the session changes, including on refresh and sign-out. */
  onSession?: (session: AuthSession | null) => void;
  /** Realtime service origin. Only needed if you use `client.realtime`. */
  realtimeUrl?: string;
  realtimeOptions?: Omit<RealtimeOptions, 'url'>;
}

const encode = encodeURIComponent;

/**
 * Typed client for the Rivisk API.
 *
 * Reads scoped to a public Stacks address need no credential. Alerts and
 * webhooks accept either an API key or a wallet session. Managing API keys and
 * the account profile needs a wallet session -- a leaked key cannot mint more
 * keys or change the notification email.
 *
 *   const rivisk = new RiviskClient({ baseUrl, apiKey });
 *   const risk = await rivisk.portfolios.risk(address);
 *
 * With a wallet session the client refreshes its own access token: a 401 is
 * retried once against a freshly minted token before it reaches the caller.
 */
export class RiviskClient {
  private readonly http: HttpClient;
  private session: AuthSession | null;
  private refreshing: Promise<boolean> | null = null;
  private realtimeClient: RealtimeClient | null = null;

  constructor(private readonly options: RiviskClientOptions = {}) {
    this.session = options.session ?? null;
    this.http = new HttpClient({
      ...options,
      baseUrl: options.baseUrl ?? 'http://localhost:4000/api/v1',
      // A wallet session wins over a static key when both are present.
      getAuthToken: () => this.session?.accessToken ?? options.apiKey,
      onUnauthorized: () => this.refreshSession(),
    });
  }

  /** The current session, if the client is signed in with a wallet. */
  getSession(): AuthSession | null {
    return this.session;
  }

  /** Replaces the session, e.g. after restoring one from storage. */
  setSession(session: AuthSession | null): void {
    this.session = session;
    this.options.onSession?.(session);
  }

  private async refreshSession(): Promise<boolean> {
    if (!this.session?.refreshToken) return false;
    // Collapse concurrent 401s onto a single refresh.
    this.refreshing ??= (async () => {
      try {
        const tokens = await this.http.post<AuthTokens>(
          '/auth/refresh',
          { refreshToken: this.session?.refreshToken },
          { skipAuthRefresh: true },
        );
        if (this.session) this.setSession({ ...this.session, ...tokens });
        return true;
      } catch {
        // A refresh token that no longer works means the session is over.
        this.setSession(null);
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** Liveness. Useful as a connectivity check during setup. */
  health(options?: RequestOptions) {
    return this.http.get<{ status: string }>('/health', options);
  }

  /** Readiness, including downstream dependencies. */
  ready(options?: RequestOptions) {
    return this.http.get<{ status: string; checks?: Record<string, unknown> }>(
      '/health/ready',
      options,
    );
  }

  // --- authentication ------------------------------------------------------

  readonly auth = {
    /**
     * Step 1: get the exact message the wallet must sign. It expires, and one
     * challenge authenticates exactly one sign-in.
     */
    challenge: (address: string, options?: RequestOptions) =>
      this.http.post<AuthChallenge>('/auth/challenge', { address }, options),

    /**
     * Step 2: exchange the signature for tokens. On success the client holds
     * the session and manages refresh itself.
     */
    verify: async (
      input: { address: string; publicKey: string; signature: string },
      options?: RequestOptions,
    ): Promise<AuthSession> => {
      const session = await this.http.post<AuthSession>('/auth/verify', input, options);
      this.setSession(session);
      return session;
    },

    /** Forces a refresh rather than waiting for a 401. */
    refresh: async (options?: RequestOptions): Promise<AuthSession> => {
      if (!this.session?.refreshToken) {
        throw new RiviskAuthError('No session to refresh', { status: 401 });
      }
      const tokens = await this.http.post<AuthTokens>(
        '/auth/refresh',
        { refreshToken: this.session.refreshToken },
        { ...options, skipAuthRefresh: true },
      );
      const next = { ...this.session, ...tokens };
      this.setSession(next);
      return next;
    },

    /** Drops the session locally. Tokens are stateless, so nothing is revoked. */
    signOut: () => this.setSession(null),

    me: (options?: RequestOptions) => this.http.get<Profile>('/auth/me', options),

    updateProfile: (
      input: { email?: string; notifyByEmail?: boolean },
      options?: RequestOptions,
    ) =>
      this.http.patch<Pick<Profile, 'email' | 'emailVerified' | 'notifyByEmail'>>(
        '/auth/me',
        input,
        options,
      ),
  };

  // --- portfolios and risk -------------------------------------------------

  readonly portfolios = {
    get: (address: string, options?: RequestOptions) =>
      this.http.get<PortfolioResponse>(`/portfolios/${encode(address)}`, options),

    risk: (address: string, options?: RequestOptions) =>
      this.http.get<RiskResponse>(`/portfolios/${encode(address)}/risk`, options),

    /**
     * Queues a fresh on-chain read. Returns as soon as the job is accepted --
     * it does not wait for indexing. Rate limited; the client backs off on 429
     * using the server's own Retry-After.
     */
    refresh: (address: string, options?: RequestOptions) =>
      this.http.post<RefreshAccepted>(
        `/portfolios/${encode(address)}/refresh`,
        undefined,
        options,
      ),
  };

  // --- stress testing ------------------------------------------------------

  readonly simulations = {
    presets: (options?: RequestOptions) =>
      this.http.get<SimulationPreset[]>('/simulations/presets', options),

    /**
     * Runs a scenario against the latest persisted snapshot. Stateless: nothing
     * is written, so this is safe to call as often as you like.
     */
    run: (
      address: string,
      input: { name?: string; shocks: PriceShock[] },
      options?: RequestOptions,
    ) =>
      this.http.post<SimulationResponse>(
        '/simulations',
        { address, ...input },
        // No side effects, so a retry cannot double-apply anything.
        { ...options, idempotent: true },
      ),
  };

  // --- alerts --------------------------------------------------------------

  readonly alerts = {
    list: (address: string, options?: RequestOptions) =>
      this.http.get<AlertsResponse>(`/alerts/${encode(address)}`, options),

    /** Requires a session for an address you control. */
    create: (
      address: string,
      input: {
        metric: AlertMetric;
        operator: AlertOperator;
        threshold: string;
        /**
         * Only `in_app` is accepted today. Email delivery is not a channel: it
         * follows the account's `notifyByEmail` setting (`auth.updateProfile`).
         */
        channel?: 'in_app';
      },
      options?: RequestOptions,
    ) =>
      this.http.post<AlertRule>(
        `/alerts/${encode(address)}`,
        { channel: 'in_app', ...input },
        options,
      ),

    setStatus: (
      id: string,
      status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
      options?: RequestOptions,
    ) => this.http.patch<AlertRule>(`/alerts/${encode(id)}`, { status }, options),

    pause: (id: string, options?: RequestOptions) =>
      this.alerts.setStatus(id, 'PAUSED', options),
    resume: (id: string, options?: RequestOptions) =>
      this.alerts.setStatus(id, 'ACTIVE', options),
    archive: (id: string, options?: RequestOptions) =>
      this.alerts.setStatus(id, 'ARCHIVED', options),
  };

  // --- on-chain policy -----------------------------------------------------

  readonly policies = {
    /** Reads the wallet-owned policy from the Clarity contract, via the API. */
    get: (address: string, options?: RequestOptions) =>
      this.http.get<PolicyResponse>(`/policies/${encode(address)}`, options),
  };

  // --- webhooks ------------------------------------------------------------

  readonly webhooks = {
    list: (options?: RequestOptions) =>
      this.http.get<{ endpoints: WebhookEndpoint[] }>('/webhooks', options),

    /** The signing secret is returned once here and never again. Store it. */
    create: (url: string, events: WebhookEventType[], options?: RequestOptions) =>
      this.http.post<WebhookCreated>('/webhooks', { url, events }, options),

    setEnabled: (id: string, enabled: boolean, options?: RequestOptions) =>
      this.http.patch<WebhookEndpoint>(`/webhooks/${encode(id)}`, { enabled }, options),

    remove: (id: string, options?: RequestOptions) =>
      this.http.delete<{ deleted: boolean }>(`/webhooks/${encode(id)}`, options),
  };

  // --- API keys ------------------------------------------------------------

  readonly apiKeys = {
    list: (options?: RequestOptions) =>
      this.http.get<{ keys: ApiKey[] }>('/api-keys', options),

    /** The token is returned once here and never again. Store it. */
    create: (name: string, live = false, options?: RequestOptions) =>
      this.http.post<ApiKeyCreated>('/api-keys', { name, live }, options),

    revoke: (id: string, options?: RequestOptions) =>
      this.http.delete<{ revoked: boolean }>(`/api-keys/${encode(id)}`, options),
  };

  // --- realtime ------------------------------------------------------------

  /**
   * Live events for an address. Needs `realtimeUrl` and the optional
   * `socket.io-client` peer dependency.
   */
  get realtime(): RealtimeClient {
    if (!this.options.realtimeUrl) {
      throw new RiviskAuthError(
        'Set `realtimeUrl` on the client to use realtime subscriptions.',
        { status: 0 },
      );
    }
    this.realtimeClient ??= new RealtimeClient({
      url: this.options.realtimeUrl,
      ...this.options.realtimeOptions,
    });
    return this.realtimeClient;
  }

  /** Closes the realtime socket, if one was opened. */
  close(): void {
    this.realtimeClient?.close();
    this.realtimeClient = null;
  }

  // --- back-compat ---------------------------------------------------------

  /** @deprecated Use `client.portfolios.get`. */
  portfolio(address: string) {
    return this.portfolios.get(address);
  }

  /** @deprecated Use `client.portfolios.risk`. */
  risk(address: string) {
    return this.portfolios.risk(address);
  }
}

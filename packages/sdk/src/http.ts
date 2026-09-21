import {
  RiviskAuthError,
  RiviskError,
  RiviskNetworkError,
  RiviskRateLimitError,
  RiviskTimeoutError,
} from './errors.js';

export interface RetryPolicy {
  /** Attempts after the first. 0 disables retrying. */
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 300,
  maxDelayMs: 8_000,
};

export interface RetryInfo {
  attempt: number;
  delayMs: number;
  error: RiviskError;
  method: string;
  path: string;
}

export interface HttpOptions {
  baseUrl: string;
  /** An `rv_live_`/`rv_test_` key, or a raw bearer token. */
  apiKey?: string;
  /** Resolves the current access token; consulted per request. */
  getAuthToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /**
   * Called once on a 401. Return true to say a fresh credential is now
   * available and the request should be retried.
   */
  onUnauthorized?: () => boolean | Promise<boolean>;
  fetch?: typeof globalThis.fetch;
  /** Per-attempt, not for the whole retry sequence. Default 30s. */
  timeoutMs?: number;
  retry?: Partial<RetryPolicy> | false;
  /** Extra headers on every request. */
  headers?: Record<string, string>;
  onRetry?: (info: RetryInfo) => void;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Overrides the default judgement about whether this call is safe to repeat.
   * GET and HEAD are idempotent; nothing else is assumed to be.
   */
  idempotent?: boolean;
  headers?: Record<string, string>;
  /**
   * Skips the `onUnauthorized` hook for this call. The refresh request itself
   * must set this: without it, a rejected refresh re-enters the hook and awaits
   * the very request it is waiting on, which deadlocks until the timeout.
   */
  skipAuthRefresh?: boolean;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RiviskTimeoutError('Request aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new RiviskTimeoutError('Request aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Seconds from a `Retry-After` header, which may be seconds or an HTTP date. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, (date - Date.now()) / 1000);
}

/**
 * Full jitter, so a fleet of clients recovering from the same outage does not
 * synchronise its retries into a second outage.
 */
export function backoffDelay(attempt: number, policy: RetryPolicy, random = Math.random): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.round(random() * ceiling);
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join(', ');
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'string') return error;
  }
  return fallback;
}

/**
 * The transport every namespace goes through.
 *
 * It owns timeouts, retries and auth so that no individual endpoint method has
 * to think about them, and so behaviour cannot drift between endpoints.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly retry: RetryPolicy | null;

  constructor(private readonly options: HttpOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    // Bound to globalThis: an unbound `fetch` reference throws "Illegal
    // invocation" in browsers.
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.retry =
      options.retry === false ? null : { ...DEFAULT_RETRY, ...(options.retry ?? {}) };
  }

  private url(path: string, query?: RequestOptions['query']): string {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private async authHeader(): Promise<Record<string, string>> {
    const token = (await this.options.getAuthToken?.()) ?? this.options.apiKey;
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const idempotent =
      options.idempotent ?? (method === 'GET' || method === 'HEAD');
    const maxRetries = this.retry?.maxRetries ?? 0;
    let refreshed = false;

    for (let attempt = 0; ; attempt++) {
      let error: RiviskError;

      try {
        return await this.attempt<T>(method, path, options);
      } catch (thrown) {
        if (!(thrown instanceof RiviskError)) throw thrown;
        error = thrown;
      }

      // One shot at refreshing a stale token before giving up on a 401.
      if (
        error.status === 401 &&
        !refreshed &&
        !options.skipAuthRefresh &&
        this.options.onUnauthorized
      ) {
        refreshed = true;
        if (await this.options.onUnauthorized()) continue;
      }

      // A 429 was never processed, so repeating it is safe whatever the method.
      // Anything else is only repeated when the call is idempotent.
      const mayRetry = error.status === 429 || idempotent;
      if (!mayRetry || !error.retryable || attempt >= maxRetries || !this.retry) {
        throw error;
      }

      const advised =
        error instanceof RiviskRateLimitError && error.retryAfterSeconds !== undefined
          ? error.retryAfterSeconds * 1000
          : undefined;
      const delayMs = Math.min(
        this.retry.maxDelayMs,
        advised ?? backoffDelay(attempt, this.retry),
      );

      this.options.onRetry?.({ attempt: attempt + 1, delayMs, error, method, path });
      await sleep(delayMs, options.signal);
    }
  }

  private async attempt<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onCallerAbort, { once: true });

    if (options.signal?.aborted) {
      clearTimeout(timer);
      throw new RiviskTimeoutError('Request aborted by the caller');
    }

    let response: Response;
    try {
      const auth = await this.authHeader();
      if (controller.signal.aborted) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
      response = await this.fetchImpl(this.url(path, options.query), {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...auth,
          ...this.options.headers,
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (cause) {
      const aborted = options.signal?.aborted;
      throw aborted
        ? new RiviskTimeoutError('Request aborted by the caller', cause)
        : controller.signal.aborted
          ? new RiviskTimeoutError(`Request timed out after ${this.timeoutMs}ms`, cause)
          : new RiviskNetworkError(
              cause instanceof Error ? cause.message : 'Network request failed',
              cause,
            );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onCallerAbort);
    }

    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      // A non-JSON body is still worth surfacing verbatim on an error.
      body = text || undefined;
    }

    if (response.ok) return body as T;

    const requestId =
      response.headers.get('x-request-id') ?? response.headers.get('x-correlation-id') ?? undefined;
    const code =
      body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : undefined;
    const message = messageFrom(body, `${response.status} ${response.statusText}`);
    const init = { status: response.status, body, code, requestId };

    if (response.status === 429) {
      throw new RiviskRateLimitError(message, {
        ...init,
        retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new RiviskAuthError(message, init);
    }
    throw new RiviskError(message, init);
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>('GET', path, options);
  }
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', path, { ...options, body });
  }
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PATCH', path, { ...options, body });
  }
  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, options);
  }
}

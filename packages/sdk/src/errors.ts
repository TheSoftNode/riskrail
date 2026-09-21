/**
 * Errors the SDK throws.
 *
 * Every failure is a `RiviskError`, so a caller can catch one type and still
 * branch on `status` or on the subclass when it matters. `retryable` says
 * whether trying the same request again could plausibly succeed -- the client
 * uses it internally, and it is exposed so callers driving their own queues can
 * use the same judgement.
 */

export interface RiviskErrorInit {
  status: number;
  body?: unknown;
  code?: string;
  requestId?: string;
  cause?: unknown;
}

export class RiviskError extends Error {
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number;
  /** Parsed response body, when there was one. */
  readonly body: unknown;
  /** Machine-readable code from the API, when it sends one. */
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(message: string, init: RiviskErrorInit) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'RiviskError';
    this.status = init.status;
    this.body = init.body;
    this.code = init.code;
    this.requestId = init.requestId;
  }

  /** True when the same request could plausibly succeed if repeated. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

/** 401 or 403: the credential is missing, expired, or not allowed to do this. */
export class RiviskAuthError extends RiviskError {
  constructor(message: string, init: RiviskErrorInit) {
    super(message, init);
    this.name = 'RiviskAuthError';
  }
}

/** 429. `retryAfterSeconds` is the server's own advice when it gives any. */
export class RiviskRateLimitError extends RiviskError {
  readonly retryAfterSeconds: number | undefined;

  constructor(message: string, init: RiviskErrorInit & { retryAfterSeconds?: number }) {
    super(message, init);
    this.name = 'RiviskRateLimitError';
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

/** The request never reached the API, or the connection failed mid-flight. */
export class RiviskNetworkError extends RiviskError {
  constructor(message: string, cause?: unknown) {
    super(message, { status: 0, cause });
    this.name = 'RiviskNetworkError';
  }
}

/** The request exceeded `timeoutMs`, or the caller's own signal aborted it. */
export class RiviskTimeoutError extends RiviskError {
  constructor(message: string, cause?: unknown) {
    super(message, { status: 0, cause });
    this.name = 'RiviskTimeoutError';
  }

  override get retryable(): boolean {
    return true;
  }
}

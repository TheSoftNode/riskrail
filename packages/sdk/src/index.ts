/**
 * @rivisk/sdk -- typed client for the Rivisk risk intelligence API.
 *
 * Zero runtime dependencies. `socket.io-client` is an optional peer, needed
 * only for realtime subscriptions.
 */

export { RiviskClient, type RiviskClientOptions } from './client.js';

export {
  RiviskError,
  RiviskAuthError,
  RiviskRateLimitError,
  RiviskNetworkError,
  RiviskTimeoutError,
  type RiviskErrorInit,
} from './errors.js';

export {
  DEFAULT_RETRY,
  backoffDelay,
  parseRetryAfter,
  type RetryInfo,
  type RetryPolicy,
  type RequestOptions,
} from './http.js';

export {
  constructWebhookEvent,
  parseSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
  DEFAULT_TOLERANCE_SECONDS,
  DELIVERY_ATTEMPT_HEADER,
  EVENT_ID_HEADER,
  EVENT_TYPE_HEADER,
  SIGNATURE_HEADER,
  type ParsedSignature,
  type VerifyOptions,
} from './webhooks.js';

export {
  RealtimeClient,
  type RealtimeHandler,
  type RealtimeOptions,
} from './realtime.js';

export * from './types.js';

/** The event names a webhook endpoint can subscribe to. */
export const WEBHOOK_EVENT_TYPES = [
  'portfolio.updated',
  'risk.updated',
  'alert.triggered',
  'policy.breached',
] as const;

/** Metrics an alert rule can watch. */
export const ALERT_METRICS = [
  'riskScoreBps',
  'healthFactorE4',
  'liquidationDistanceBps',
  'protocolConcentrationBps',
  'assetConcentrationBps',
  'liquidityScoreBps',
  'capitalAccessibilityBps',
] as const;

/**
 * Fixed-point helpers.
 *
 * The API sends integers to avoid float drift, which means every consumer
 * otherwise reimplements the same three conversions -- and getting
 * `healthFactorE4` wrong by a factor of 10000 is not a subtle bug.
 */
export const fromBps = (bps: number): number => bps / 10_000;
export const toBps = (ratio: number): number => Math.round(ratio * 10_000);
export const fromE4 = (e4: number): number => e4 / 10_000;
export const toE4 = (value: number): number => Math.round(value * 10_000);
/** Basis points as a percentage, e.g. 4400 -> 44. */
export const bpsToPercent = (bps: number): number => bps / 100;

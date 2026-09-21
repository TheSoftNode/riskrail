import { Redis } from 'ioredis';
import { Queue } from 'bullmq';

export interface PortfolioRefreshJob {
  address: string;
  correlationId: string;
  requestedAt: string;
  force?: boolean;
}

export interface RiskRecalculateJob {
  address: string;
  correlationId: string;
  sourceBlock: number;
  requestedAt: string;
}

export interface AlertEvaluateJob {
  address: string;
  riskSnapshotId: string;
  correlationId: string;
  sourceBlock: number;
  requestedAt: string;
}

export interface WebhookDeliverJob {
  endpointId: string;
  event: {
    id: string;
    type: 'portfolio.updated' | 'risk.updated' | 'alert.triggered' | 'policy.breached';
    address: string;
    createdAt: string;
    data: Record<string, unknown>;
  };
  attempt: number;
}

export interface RiskAttestationJob {
  address: string;
  riskSnapshotId: string;
  correlationId: string;
  requestedAt: string;
}

/**
 * Builds a BullMQ custom job id.
 *
 * BullMQ rejects `:` in custom ids -- it uses that character as its own Redis
 * key separator, and `queue.add` throws `Custom Id cannot contain :` at
 * runtime. Every job id here was colon-delimited, which meant no job could be
 * enqueued at all: no indexing, no alerts, no webhook deliveries. Unit tests
 * missed it because they mock the queue; only a real Redis surfaces it.
 *
 * Empty and nullish parts are dropped so an optional block height or attempt
 * number does not leave a trailing separator.
 */
export function jobId(...parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .map((part) => String(part).replace(/:/g, '-'))
    .join('-');
}

export function createRedisConnection(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export function createQueue<T = unknown>(name: string, connection = createRedisConnection()) {
  return new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 60 * 60, count: 5_000 },
      removeOnFail: { age: 24 * 60 * 60, count: 5_000 },
    },
  });
}

export interface RealtimeEvent {
  event: 'portfolio.updated' | 'risk.updated' | 'alert.triggered' | 'policy.breached';
  address: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export const RealtimeChannel = 'rivisk.realtime';

export const QueueName = {
  Portfolio: 'rivisk.portfolio',
  Risk: 'rivisk.risk',
  Alerts: 'rivisk.alerts',
  Attestations: 'rivisk.attestations',
  Webhooks: 'rivisk.webhooks',
} as const;

export const JobName = {
  PortfolioRefresh: 'portfolio.refresh',
  RiskRecalculate: 'risk.recalculate',
  RiskAttest: 'risk.attest',
  AlertEvaluate: 'alert.evaluate',
  WebhookDeliver: 'webhook.deliver',
} as const;

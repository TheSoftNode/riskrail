import IORedis from 'ioredis';
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

export interface RiskAttestationJob {
  address: string;
  riskSnapshotId: string;
  correlationId: string;
  requestedAt: string;
}

export function createRedisConnection(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  return new IORedis(url, {
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

export const RealtimeChannel = 'riskrail.realtime';

export const QueueName = {
  Portfolio: 'riskrail.portfolio',
  Risk: 'riskrail.risk',
  Alerts: 'riskrail.alerts',
  Attestations: 'riskrail.attestations',
  Webhooks: 'riskrail.webhooks',
} as const;

export const JobName = {
  PortfolioRefresh: 'portfolio.refresh',
  RiskRecalculate: 'risk.recalculate',
  RiskAttest: 'risk.attest',
  AlertEvaluate: 'alert.evaluate',
} as const;

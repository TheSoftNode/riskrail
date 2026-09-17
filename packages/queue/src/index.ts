import IORedis from 'ioredis';
import { Queue } from 'bullmq';

export function createRedisConnection(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function createQueue<T = unknown>(name: string, connection = createRedisConnection()) {
  return new Queue<T>(name, { connection });
}

export const QueueName = {
  Portfolio: 'riskrail.portfolio',
  Risk: 'riskrail.risk',
  Alerts: 'riskrail.alerts',
  Attestations: 'riskrail.attestations',
  Webhooks: 'riskrail.webhooks',
} as const;

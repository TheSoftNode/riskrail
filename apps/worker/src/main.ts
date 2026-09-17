import { Worker } from 'bullmq';
import { createLogger } from '@riskrail/logger';
import { createRedisConnection, QueueName } from '@riskrail/queue';

const log = createLogger('riskrail-worker');
const connection = createRedisConnection();

const riskWorker = new Worker(
  QueueName.Risk,
  async (job) => {
    log.info({ jobId: job.id, name: job.name }, 'risk job received');
    return { accepted: true };
  },
  { connection },
);

riskWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'risk job failed'));
log.info('worker online');

async function shutdown() {
  await riskWorker.close();
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

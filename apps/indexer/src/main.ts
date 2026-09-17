import { createLogger } from '@riskrail/logger';
import { StacksClient } from '@riskrail/stacks';

const log = createLogger('riskrail-indexer');
const apiUrl = process.env.STACKS_API_URL ?? 'https://api.testnet.hiro.so';
const client = new StacksClient(apiUrl, process.env.STACKS_API_KEY);

async function heartbeat() {
  try {
    const height = await client.getCurrentBlockHeight();
    log.info({ blockHeight: height, apiUrl }, 'indexer heartbeat');
  } catch (error) {
    log.error({ error }, 'indexer heartbeat failed');
  }
}

await heartbeat();
const timer = setInterval(heartbeat, 30_000);
process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });

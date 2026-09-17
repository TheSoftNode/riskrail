import { randomUUID } from 'node:crypto';
import { Worker } from 'bullmq';
import type { ProtocolAdapter } from '@riskrail/adapter-core';
import { BitPayAdapter, StacksBitPayReader } from '@riskrail/adapter-bitpay';
import { NativeStacksAdapter } from '@riskrail/adapter-native-stacks';
import { failIndexingRun, persistPortfolio, prisma } from '@riskrail/database';
import { createLogger } from '@riskrail/logger';
import { CoinGeckoPriceOracle } from '@riskrail/oracle';
import { buildPortfolio, valuePositions } from '@riskrail/portfolio-engine';
import {
  createQueue,
  createRedisConnection,
  JobName,
  QueueName,
  type PortfolioRefreshJob,
  type RiskRecalculateJob,
} from '@riskrail/queue';
import { StacksClient, isStacksPrincipal } from '@riskrail/stacks';

const log = createLogger('riskrail-indexer');
const apiUrl = process.env.STACKS_API_URL ?? 'https://api.testnet.hiro.so';
const stacksApiKey = process.env.STACKS_API_KEY || undefined;
const stacks = new StacksClient(apiUrl, stacksApiKey);
const priceOracle = new CoinGeckoPriceOracle(
  process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3',
  process.env.COINGECKO_API_KEY || undefined,
);
const connection = createRedisConnection();
const riskQueue = createQueue<RiskRecalculateJob>(QueueName.Risk, connection);

function createAdapters(): ProtocolAdapter[] {
  const adapters: ProtocolAdapter[] = [new NativeStacksAdapter()];
  const contractId = process.env.BITPAY_CORE_CONTRACT;
  if (contractId) {
    const reader = new StacksBitPayReader(apiUrl, contractId, undefined, stacksApiKey);
    adapters.push(new BitPayAdapter(reader, contractId));
  }
  return adapters;
}

const adapters = createAdapters();

async function indexWallet(job: PortfolioRefreshJob) {
  const { address, correlationId } = job;
  if (!isStacksPrincipal(address)) throw new Error(`Invalid Stacks principal: ${address}`);

  try {
    const blockHeight = await stacks.getCurrentBlockHeight();
    const positions = [];

    for (const adapter of adapters) {
      const supported = await adapter.supports(address, { stacksApiUrl: apiUrl, blockHeight });
      if (!supported) continue;
      const adapterPositions = await adapter.getPositions(address, { stacksApiUrl: apiUrl, blockHeight });
      positions.push(...adapterPositions);
    }

    const uniqueAssets = new Map<string, { assetId: string; symbol: string }>();
    for (const position of positions) {
      for (const asset of position.assets) {
        uniqueAssets.set(asset.assetId, { assetId: asset.assetId, symbol: asset.symbol });
      }
    }

    let prices = new Map();
    try {
      prices = await priceOracle.getUsdPrices([...uniqueAssets.values()]);
    } catch (error) {
      // Indexing should still preserve exact on-chain balances if an external price
      // source is briefly unavailable. Valuation coverage makes the limitation visible.
      log.warn({ error, address }, 'price oracle unavailable; persisting unvalued positions');
    }

    const valued = valuePositions(positions, prices);
    const portfolio = buildPortfolio(address, valued);
    await persistPortfolio({ portfolio, blockHeight, correlationId });

    await riskQueue.add(
      JobName.RiskRecalculate,
      {
        address,
        correlationId,
        sourceBlock: blockHeight,
        requestedAt: new Date().toISOString(),
      },
      { jobId: `risk:${correlationId}` },
    );

    log.info({
      address,
      correlationId,
      blockHeight,
      positions: valued.length,
      valuationCoverageBps: portfolio.valuationCoverageBps,
    }, 'wallet indexed');

    return { address, blockHeight, positionCount: valued.length };
  } catch (error) {
    await failIndexingRun(correlationId, address, error);
    throw error;
  }
}

const worker = new Worker<PortfolioRefreshJob>(
  QueueName.Portfolio,
  async (bullJob) => {
    if (bullJob.name !== JobName.PortfolioRefresh) return { ignored: true };
    return indexWallet(bullJob.data);
  },
  { connection, concurrency: Number(process.env.INDEXER_CONCURRENCY ?? 4) },
);

worker.on('failed', (job, error) => {
  log.error({ jobId: job?.id, address: job?.data.address, error }, 'wallet indexing failed');
});

worker.on('completed', (job) => {
  log.debug({ jobId: job.id, address: job.data.address }, 'wallet indexing completed');
});

// Optional bootstrap addresses are useful for local development and grant demos.
const bootstrapAddresses = (process.env.MONITORED_WALLETS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (bootstrapAddresses.length > 0) {
  const queue = createQueue<PortfolioRefreshJob>(QueueName.Portfolio, connection);
  for (const address of bootstrapAddresses) {
    const correlationId = randomUUID();
    await queue.add(JobName.PortfolioRefresh, {
      address,
      correlationId,
      requestedAt: new Date().toISOString(),
    }, { jobId: `bootstrap:${address}:${correlationId}` });
  }
}

log.info({
  apiUrl,
  adapters: adapters.map((adapter) => adapter.metadata().id),
}, 'indexer online');

async function shutdown() {
  await worker.close();
  await riskQueue.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

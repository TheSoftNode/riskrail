import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Worker } from 'bullmq';
import type { NormalizedPosition } from '@riskrail/adapter-core';
import {
  getCurrentPortfolio,
  markRiskSnapshotPublished,
  persistRiskSnapshot,
  prisma,
} from '@riskrail/database';
import { createLogger } from '@riskrail/logger';
import {
  createQueue,
  createRedisConnection,
  JobName,
  QueueName,
  type RiskAttestationJob,
  type RiskRecalculateJob,
} from '@riskrail/queue';
import { calculatePortfolioRisk } from '@riskrail/risk-engine';
import { RiskRegistryPublisher } from '@riskrail/riskrail-contracts';

const METHODOLOGY_VERSION = 'riskrail-v1';
const log = createLogger('riskrail-worker');
const connection = createRedisConnection();
const attestationQueue = createQueue<RiskAttestationJob>(QueueName.Attestations, connection);

const riskWorker = new Worker<RiskRecalculateJob>(
  QueueName.Risk,
  async (job) => {
    if (job.name !== JobName.RiskRecalculate) return { ignored: true };
    const { address, correlationId, sourceBlock } = job.data;
    const wallet = await getCurrentPortfolio(address);
    if (!wallet) throw new Error(`Cannot calculate risk before wallet is indexed: ${address}`);

    const positions = wallet.positions.map((position) => position.raw as unknown as NormalizedPosition);
    const risk = calculatePortfolioRisk(positions);
    const report = {
      version: METHODOLOGY_VERSION,
      wallet: address,
      sourceBlock,
      generatedAt: new Date().toISOString(),
      valuationCoverageBps: wallet.snapshots[0]?.valuationCoverageBps ?? 0,
      metrics: risk,
      positions: positions.map((position) => ({
        id: position.id,
        protocolId: position.protocol.id,
        type: position.type,
        valueUsd: position.valueUsd ?? null,
        accessibility: position.accessibility ?? null,
        liquidation: position.liquidation ?? null,
      })),
      notes: {
        liquidityScore: 'MVP proxy based on capital accessibility until market-depth adapters are enabled.',
        compositeScore: 'Presentation aid only. Individual metrics remain the primary risk evidence.',
      },
    };

    const serializableReport = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
    const reportHash = sha256Canonical(serializableReport);
    const snapshot = await persistRiskSnapshot({
      address,
      riskLevel: risk.riskLevel,
      riskScoreBps: risk.riskScoreBps,
      healthFactorE4: risk.worstHealthFactorE4,
      liquidationDistanceBps: risk.liquidationDistanceBps,
      protocolConcentrationBps: risk.protocolConcentrationBps,
      assetConcentrationBps: risk.assetConcentrationBps,
      liquidityScoreBps: risk.liquidityScoreBps,
      capitalAccessibilityBps: risk.capitalAccessibilityBps,
      reportHash,
      report: serializableReport as Prisma.InputJsonValue,
      sourceBlock,
      methodologyVersion: METHODOLOGY_VERSION,
    });

    if (process.env.RISK_PUBLISHER_ENABLED === 'true' && process.env.RISK_REGISTRY_CONTRACT) {
      await attestationQueue.add(
        JobName.RiskAttest,
        {
          address,
          riskSnapshotId: snapshot.id,
          correlationId,
          requestedAt: new Date().toISOString(),
        },
        { jobId: `attestation:${snapshot.id}` },
      );
    }

    log.info({ address, correlationId, riskSnapshotId: snapshot.id, reportHash, risk }, 'risk snapshot persisted');
    return { riskSnapshotId: snapshot.id, reportHash };
  },
  { connection, concurrency: Number(process.env.RISK_WORKER_CONCURRENCY ?? 4) },
);

const attestationWorker = new Worker<RiskAttestationJob>(
  QueueName.Attestations,
  async (job) => {
    if (job.name !== JobName.RiskAttest) return { ignored: true };
    if (process.env.RISK_PUBLISHER_ENABLED !== 'true') return { skipped: 'publisher-disabled' };

    const contract = process.env.RISK_REGISTRY_CONTRACT;
    const senderKey = process.env.RISK_PUBLISHER_SECRET_KEY;
    const network = process.env.STACKS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    if (!contract || !senderKey) throw new Error('Risk publisher is enabled but contract/key configuration is missing');

    const snapshot = await prisma.riskSnapshot.findUnique({
      where: { id: job.data.riskSnapshotId },
      include: { wallet: true },
    });
    if (!snapshot) throw new Error(`Risk snapshot not found: ${job.data.riskSnapshotId}`);
    if (snapshot.onchainTxId) return { txId: snapshot.onchainTxId, alreadyPublished: true };

    const publisher = new RiskRegistryPublisher({ riskRegistry: contract, network }, senderKey);
    const result = await publisher.publish({
      wallet: snapshot.wallet.address,
      riskScoreBps: snapshot.riskScoreBps,
      healthFactorE4: snapshot.healthFactorE4 ?? undefined,
      liquidationDistanceBps: snapshot.liquidationDistanceBps ?? undefined,
      protocolConcentrationBps: snapshot.protocolConcentrationBps,
      liquidityScoreBps: snapshot.liquidityScoreBps,
      sourceBlock: Number(snapshot.sourceBlock),
      reportHash: snapshot.reportHash,
    });

    await markRiskSnapshotPublished(snapshot.id, { onchainTxId: result.txId });
    log.info({ riskSnapshotId: snapshot.id, txId: result.txId }, 'risk attestation broadcast');
    return result;
  },
  { connection, concurrency: 1 },
);

riskWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'risk job failed'));
attestationWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'attestation job failed'));
log.info({ methodologyVersion: METHODOLOGY_VERSION }, 'risk worker online');

export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

async function shutdown() {
  await riskWorker.close();
  await attestationWorker.close();
  await attestationQueue.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

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
  RealtimeChannel,
  type AlertEvaluateJob,
  type RiskAttestationJob,
  type RiskRecalculateJob,
} from '@riskrail/queue';
import { calculatePortfolioRisk, runDefaultStressScenarios } from '@riskrail/risk-engine';
import { RiskPolicyReader, RiskRegistryPublisher } from '@riskrail/riskrail-contracts';
import { crossedIntoBreach, metricValue, policyChecks, type MetricSnapshot } from './alert-evaluator.js';

const METHODOLOGY_VERSION = 'riskrail-v1.2';
const log = createLogger('riskrail-worker');
const connection = createRedisConnection();
const realtimePublisher = createRedisConnection();
const attestationQueue = createQueue<RiskAttestationJob>(QueueName.Attestations, connection);
const alertQueue = createQueue<AlertEvaluateJob>(QueueName.Alerts, connection);

const riskWorker = new Worker<RiskRecalculateJob>(
  QueueName.Risk,
  async (job) => {
    if (job.name !== JobName.RiskRecalculate) return { ignored: true };
    const { address, correlationId, sourceBlock } = job.data;
    const wallet = await getCurrentPortfolio(address);
    if (!wallet) throw new Error(`Cannot calculate risk before wallet is indexed: ${address}`);

    const positions = wallet.positions.map((position) => position.raw as unknown as NormalizedPosition);
    const risk = calculatePortfolioRisk(positions);
    const stress = runDefaultStressScenarios(positions);
    const report = {
      version: METHODOLOGY_VERSION,
      wallet: address,
      sourceBlock,
      generatedAt: new Date().toISOString(),
      valuationCoverageBps: wallet.snapshots[0]?.valuationCoverageBps ?? 0,
      metrics: risk,
      stress: stress.map((result) => ({
        scenario: result.scenario,
        after: result.after,
        warnings: result.warnings,
        positions: result.positions.filter((position) =>
          position.beforeHealthFactorE4 !== undefined || position.afterHealthFactorE4 !== undefined,
        ),
      })),
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

    await realtimePublisher.publish(RealtimeChannel, JSON.stringify({
      event: 'risk.updated',
      address,
      data: {
        riskSnapshotId: snapshot.id,
        riskLevel: risk.riskLevel,
        riskScoreBps: risk.riskScoreBps,
        healthFactorE4: risk.worstHealthFactorE4 ?? null,
        reportHash,
      },
      timestamp: new Date().toISOString(),
    }));

    await alertQueue.add(
      JobName.AlertEvaluate,
      {
        address,
        riskSnapshotId: snapshot.id,
        correlationId,
        sourceBlock,
        requestedAt: new Date().toISOString(),
      },
      { jobId: `alerts:${snapshot.id}` },
    );

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

const alertWorker = new Worker<AlertEvaluateJob>(
  QueueName.Alerts,
  async (job) => {
    if (job.name !== JobName.AlertEvaluate) return { ignored: true };
    const snapshot = await prisma.riskSnapshot.findUnique({
      where: { id: job.data.riskSnapshotId },
      include: { wallet: true },
    });
    if (!snapshot) throw new Error(`Risk snapshot not found: ${job.data.riskSnapshotId}`);

    const previous = await prisma.riskSnapshot.findFirst({
      where: { walletId: snapshot.walletId, id: { not: snapshot.id }, observedAt: { lt: snapshot.observedAt } },
      orderBy: { observedAt: 'desc' },
    });

    const localRules = await prisma.alertRule.findMany({
      where: { walletId: snapshot.walletId, status: 'ACTIVE' },
    });
    let localTriggered = 0;

    for (const rule of localRules) {
      const currentValue = metricValue(snapshot as MetricSnapshot, rule.metric);
      if (currentValue === undefined) continue;
      const threshold = Number(rule.threshold);
      if (!Number.isFinite(threshold)) continue;
      const previousValue = previous ? metricValue(previous as MetricSnapshot, rule.metric) : undefined;
      if (!crossedIntoBreach(currentValue, previousValue, rule.operator, threshold)) continue;

      const event = await prisma.alertEvent.create({
        data: {
          alertId: rule.id,
          value: String(currentValue),
          metadata: {
            source: 'risk-snapshot',
            riskSnapshotId: snapshot.id,
            sourceBlock: snapshot.sourceBlock.toString(),
            riskLevel: snapshot.riskLevel,
          },
        },
      });
      localTriggered += 1;
      await publishRealtime('alert.triggered', snapshot.wallet.address, {
        alertEventId: event.id,
        alertRuleId: rule.id,
        metric: rule.metric,
        operator: rule.operator,
        threshold: rule.threshold,
        value: String(currentValue),
      });
    }

    const policyTriggered = await evaluateOnchainPolicy(snapshot as SnapshotWithWallet, previous as MetricSnapshot | null);
    log.info({
      address: snapshot.wallet.address,
      riskSnapshotId: snapshot.id,
      localTriggered,
      policyTriggered,
    }, 'alert evaluation completed');
    return { localTriggered, policyTriggered };
  },
  { connection, concurrency: Number(process.env.ALERT_WORKER_CONCURRENCY ?? 4) },
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

type SnapshotWithWallet = MetricSnapshot & {
  id: string;
  walletId: string;
  sourceBlock: bigint;
  wallet: { address: string };
};

async function evaluateOnchainPolicy(
  snapshot: SnapshotWithWallet,
  previous: MetricSnapshot | null,
): Promise<number> {
  const contract = process.env.RISK_POLICY_CONTRACT;
  if (!contract) return 0;

  try {
    const reader = new RiskPolicyReader(
      process.env.STACKS_API_URL ?? 'https://api.hiro.so',
      contract,
      process.env.STACKS_API_KEY || process.env.HIRO_API_KEY || undefined,
    );
    const policy = await reader.getPolicy(snapshot.wallet.address);
    if (!policy?.enabled) return 0;

    const checks = policyChecks(policy);

    let triggered = 0;
    for (const check of checks) {
      const currentValue = metricValue(snapshot as MetricSnapshot, check.metric);
      const previousValue = previous ? metricValue(previous as MetricSnapshot, check.metric) : undefined;
      if (!crossedIntoBreach(currentValue, previousValue, check.operator, check.threshold) || currentValue === undefined) continue;

      const event = await prisma.policyBreachEvent.create({
        data: {
          walletId: snapshot.walletId,
          metric: check.metric,
          operator: check.operator,
          threshold: String(check.threshold),
          value: String(currentValue),
          sourceBlock: snapshot.sourceBlock,
          metadata: policy as unknown as Prisma.InputJsonValue,
        },
      });
      triggered += 1;
      await publishRealtime('policy.breached', snapshot.wallet.address, {
        policyBreachEventId: event.id,
        metric: check.metric,
        operator: check.operator,
        threshold: String(check.threshold),
        value: String(currentValue),
      });
    }
    return triggered;
  } catch (error) {
    log.warn({ error, address: snapshot.wallet.address, contract }, 'on-chain policy read failed; local alerts still evaluated');
    return 0;
  }
}

async function publishRealtime(event: 'alert.triggered' | 'policy.breached', address: string, data: Record<string, unknown>) {
  await realtimePublisher.publish(RealtimeChannel, JSON.stringify({
    event,
    address,
    data,
    timestamp: new Date().toISOString(),
  }));
}

riskWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'risk job failed'));
alertWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'alert evaluation job failed'));
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
  await alertWorker.close();
  await attestationWorker.close();
  await alertQueue.close();
  await attestationQueue.close();
  await connection.quit();
  await realtimePublisher.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

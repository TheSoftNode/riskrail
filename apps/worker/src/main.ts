import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Worker } from 'bullmq';
import type { NormalizedPosition } from '@rivisk/adapter-core';
import {
  getCurrentPortfolio,
  markRiskSnapshotPublished,
  persistRiskSnapshot,
  planDeliveries,
  prisma,
} from '@rivisk/database';
import { createLogger } from '@rivisk/logger';
import {
  createQueue,
  createRedisConnection,
  JobName,
  QueueName,
  RealtimeChannel,
  type WebhookDeliverJob,
  type AlertEvaluateJob,
  type RiskAttestationJob,
  type RiskRecalculateJob,
  jobId,
} from '@rivisk/queue';
import { calculatePortfolioRisk, runDefaultStressScenarios } from '@rivisk/risk-engine';
import { RiskPolicyReader, RiskRegistryPublisher } from '@rivisk/rivisk-contracts';
import { createMailer, dedupeKey, renderAlertEmail } from '@rivisk/notifications';
import { buildEvent } from '@rivisk/webhooks';
import { crossedIntoBreach, metricValue, policyChecks, type MetricSnapshot } from './alert-evaluator.js';
import { deliver } from './webhook-delivery.js';
import { decideAttestation, minIntervalFromEnv } from './attestation-throttle.js';

const METHODOLOGY_VERSION = 'rivisk-v1.2';
const log = createLogger('rivisk-worker');
const connection = createRedisConnection();
const realtimePublisher = createRedisConnection();
const attestationQueue = createQueue<RiskAttestationJob>(QueueName.Attestations, connection);
const alertQueue = createQueue<AlertEvaluateJob>(QueueName.Alerts, connection);
const webhookQueue = createQueue<WebhookDeliverJob>(QueueName.Webhooks, connection);
const mailer = createMailer();
const attestationMinIntervalBlocks = minIntervalFromEnv(process.env.ATTESTATION_MIN_INTERVAL_BLOCKS);

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

    await emit('risk.updated', address, {
      riskSnapshotId: snapshot.id,
      riskLevel: risk.riskLevel,
      riskScoreBps: risk.riskScoreBps,
      healthFactorE4: risk.worstHealthFactorE4 ?? null,
      reportHash,
    });

    await alertQueue.add(
      JobName.AlertEvaluate,
      {
        address,
        riskSnapshotId: snapshot.id,
        correlationId,
        sourceBlock,
        requestedAt: new Date().toISOString(),
      },
      { jobId: jobId('alerts', snapshot.id) },
    );

    // Say why nothing is being attested. Silence here is indistinguishable from
    // a broken publisher, and the likeliest post-deployment mistake is leaving
    // RISK_PUBLISHER_ENABLED false after the contracts go live.
    if (process.env.RISK_PUBLISHER_ENABLED !== 'true') {
      log.debug({ address, riskSnapshotId: snapshot.id }, 'attestation skipped: RISK_PUBLISHER_ENABLED is not true');
    } else if (!process.env.RISK_REGISTRY_CONTRACT) {
      log.warn(
        { address, riskSnapshotId: snapshot.id },
        'attestation skipped: RISK_PUBLISHER_ENABLED is true but RISK_REGISTRY_CONTRACT is empty',
      );
    }

    if (process.env.RISK_PUBLISHER_ENABLED === 'true' && process.env.RISK_REGISTRY_CONTRACT) {
      await attestationQueue.add(
        JobName.RiskAttest,
        {
          address,
          riskSnapshotId: snapshot.id,
          correlationId,
          requestedAt: new Date().toISOString(),
        },
        { jobId: jobId('attestation', snapshot.id) },
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
      await sendAlertEmail({
        address: snapshot.wallet.address,
        ruleId: rule.id,
        sourceBlock: snapshot.sourceBlock.toString(),
        metricLabel: rule.metric,
        comparison: rule.operator,
        observed: String(currentValue),
        threshold: rule.threshold.toString(),
        source: 'local',
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

    // This worker runs with concurrency 1, so the previous job has already
    // stored its txId: two quick refreshes cannot both slip through.
    const lastPublished = await prisma.riskSnapshot.findFirst({
      where: { walletId: snapshot.walletId, id: { not: snapshot.id }, onchainTxId: { not: null } },
      orderBy: [{ sourceBlock: 'desc' }, { observedAt: 'desc' }],
    });
    const decision = decideAttestation(snapshot, lastPublished, attestationMinIntervalBlocks);
    if (!decision.publish) {
      log.info(
        { riskSnapshotId: snapshot.id, lastTxId: lastPublished?.onchainTxId, ...decision },
        'attestation skipped: unchanged since the last one',
      );
      return { skipped: decision.reason, lastTxId: lastPublished?.onchainTxId };
    }

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
    log.info({ riskSnapshotId: snapshot.id, txId: result.txId, reason: decision.reason }, 'risk attestation broadcast');
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
      await sendAlertEmail({
        address: snapshot.wallet.address,
        ruleId: `policy:${check.metric}`,
        sourceBlock: snapshot.sourceBlock.toString(),
        metricLabel: check.metric,
        comparison: check.operator,
        observed: String(currentValue),
        threshold: String(check.threshold),
        source: 'on-chain',
      });
    }
    return triggered;
  } catch (error) {
    log.warn({ error, address: snapshot.wallet.address, contract }, 'on-chain policy read failed; local alerts still evaluated');
    return 0;
  }
}

/**
 * Emails the wallet's owner, if there is one and they have opted in. Silent when
 * SMTP is unconfigured — email is optional, and a missing mailer must not stop
 * the in-app alert that already fired.
 */
async function sendAlertEmail(input: {
  address: string;
  ruleId: string;
  sourceBlock: string;
  metricLabel: string;
  comparison: string;
  observed: string;
  threshold: string;
  source: 'local' | 'on-chain';
}) {
  if (!mailer.enabled) return;

  try {
    const wallet = await prisma.wallet.findUnique({
      where: { address: input.address },
      select: { user: { select: { id: true, email: true, notifyByEmail: true } } },
    });
    const user = wallet?.user;
    if (!user?.email || !user.notifyByEmail) return;

    const key = dedupeKey({ userId: user.id, ruleId: input.ruleId, sourceBlock: input.sourceBlock });
    const email = renderAlertEmail({
      address: input.address,
      metricLabel: input.metricLabel,
      comparison: input.comparison,
      observed: input.observed,
      threshold: input.threshold,
      source: input.source,
      dashboardUrl: `${process.env.WEB_URL ?? 'http://localhost:3000'}/dashboard?address=${encodeURIComponent(input.address)}`,
    });

    // The unique dedupeKey is what actually prevents a double-send; a race
    // between two workers loses here rather than emailing twice.
    try {
      await prisma.notification.create({
        data: { userId: user.id, channel: 'email', subject: email.subject, body: email.text, dedupeKey: key },
      });
    } catch {
      return; // already queued by another worker
    }

    const result = await mailer.send(user.email, email);
    await prisma.notification.update({
      where: { dedupeKey: key },
      data: result.sent ? { sentAt: new Date() } : { error: result.error ?? 'unknown' },
    });
    if (result.sent) log.info({ address: input.address }, 'alert email sent');
    else log.warn({ address: input.address, error: result.error }, 'alert email failed');
  } catch (error) {
    log.warn({ error, address: input.address }, 'alert email skipped');
  }
}

async function publishRealtime(event: 'alert.triggered' | 'policy.breached', address: string, data: Record<string, unknown>) {
  await emit(event, address, data);
}

/**
 * Every risk event goes to two places: the Redis channel the dashboard listens
 * on, and the webhook queue. Routing both through one function means a new
 * event type cannot reach the UI while silently skipping subscribers.
 */
async function emit(
  event: 'portfolio.updated' | 'risk.updated' | 'alert.triggered' | 'policy.breached',
  address: string,
  data: Record<string, unknown>,
) {
  await realtimePublisher.publish(RealtimeChannel, JSON.stringify({
    event,
    address,
    data,
    timestamp: new Date().toISOString(),
  }));

  try {
    const built = buildEvent(event, address, data);
    for (const target of await planDeliveries(built.type)) {
      await webhookQueue.add(
        JobName.WebhookDeliver,
        { endpointId: target.endpointId, event: built, attempt: 1 },
        { jobId: jobId('wh', built.id, target.endpointId) },
      );
    }
  } catch (error) {
    // A webhook fan-out failure must never take down risk processing.
    log.warn({ error, event, address }, 'webhook fan-out failed');
  }
}

const webhookWorker = new Worker<WebhookDeliverJob>(
  QueueName.Webhooks,
  async (bullJob) => {
    const job = bullJob.data;
    const outcome = await deliver(job);
    if (outcome.delivered) {
      log.info({ endpointId: job.endpointId, eventId: job.event.id }, 'webhook delivered');
      return outcome;
    }
    if (outcome.retryInSeconds !== undefined) {
      await webhookQueue.add(
        JobName.WebhookDeliver,
        { ...job, attempt: job.attempt + 1 },
        { delay: outcome.retryInSeconds * 1000, jobId: jobId('wh', job.event.id, job.endpointId, job.attempt + 1) },
      );
      log.warn({ endpointId: job.endpointId, attempt: job.attempt, retryInSeconds: outcome.retryInSeconds }, 'webhook retry scheduled');
    } else {
      log.warn({ endpointId: job.endpointId, statusCode: outcome.statusCode, error: outcome.error }, 'webhook dropped');
    }
    return outcome;
  },
  { connection },
);

riskWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'risk job failed'));
alertWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'alert evaluation job failed'));
attestationWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'attestation job failed'));
webhookWorker.on('failed', (job, error) => log.error({ jobId: job?.id, error }, 'webhook delivery job failed'));
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

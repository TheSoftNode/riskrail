import { Prisma, PrismaClient, PositionType as PrismaPositionType } from '@prisma/client';
import type { NormalizedPosition, PositionType } from '@rivisk/adapter-core';
import type { Portfolio } from '@rivisk/portfolio-engine';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export interface PersistPortfolioInput {
  portfolio: Portfolio;
  blockHeight: number;
  correlationId: string;
}

export async function persistPortfolio(input: PersistPortfolioInput) {
  const { portfolio, blockHeight, correlationId } = input;
  const observedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { address: portfolio.owner },
      update: { lastIndexedAt: observedAt },
      create: { address: portfolio.owner, lastIndexedAt: observedAt },
    });

    await tx.indexingRun.upsert({
      where: { correlationId },
      update: { status: 'processing', sourceBlock: BigInt(blockHeight) },
      create: {
        walletId: wallet.id,
        correlationId,
        sourceBlock: BigInt(blockHeight),
        status: 'processing',
      },
    });

    const currentIds = new Set(portfolio.positions.map((position) => position.id));
    const active = await tx.position.findMany({
      where: { walletId: wallet.id, active: true },
      select: { id: true },
    });
    const closedIds = active.map((row) => row.id).filter((id) => !currentIds.has(id));
    if (closedIds.length > 0) {
      await tx.position.updateMany({
        where: { id: { in: closedIds } },
        data: { active: false, closedAt: observedAt },
      });
    }

    for (const position of portfolio.positions) {
      await upsertProtocol(tx, position);
      const persisted = await tx.position.upsert({
        where: { id: position.id },
        update: {
          walletId: wallet.id,
          protocolId: position.protocol.id,
          type: toPrismaPositionType(position.type),
          valueUsd: decimalOrNull(position.valueUsd),
          blockHeight: BigInt(position.source.blockHeight || blockHeight),
          exact: position.source.exact,
          active: true,
          closedAt: null,
          raw: toJsonValue(position),
          observedAt: new Date(position.source.observedAt),
        },
        create: {
          id: position.id,
          walletId: wallet.id,
          protocolId: position.protocol.id,
          type: toPrismaPositionType(position.type),
          valueUsd: decimalOrNull(position.valueUsd),
          blockHeight: BigInt(position.source.blockHeight || blockHeight),
          exact: position.source.exact,
          raw: toJsonValue(position),
          observedAt: new Date(position.source.observedAt),
        },
      });

      await tx.positionAsset.deleteMany({ where: { positionId: persisted.id } });
      if (position.assets.length > 0) {
        await tx.positionAsset.createMany({
          data: position.assets.map((asset) => ({
            positionId: persisted.id,
            assetId: asset.assetId,
            symbol: asset.symbol,
            role: asset.role,
            amountAtomic: asset.amountAtomic,
            decimals: asset.decimals,
            valueUsd: decimalOrNull(asset.valueUsd),
          })),
        });
      }

      await tx.positionSnapshot.create({
        data: {
          positionId: persisted.id,
          valueUsd: decimalOrNull(position.valueUsd),
          state: toJsonValue(position),
          blockHeight: BigInt(position.source.blockHeight || blockHeight),
          observedAt,
        },
      });
    }

    const snapshot = await tx.portfolioSnapshot.create({
      data: {
        walletId: wallet.id,
        totalValueUsd: new Prisma.Decimal(portfolio.totalValueUsd),
        protocolValues: portfolio.byProtocol as Prisma.InputJsonValue,
        assetValues: portfolio.byAsset as Prisma.InputJsonValue,
        valuationCoverageBps: portfolio.valuationCoverageBps,
        blockHeight: BigInt(blockHeight),
        observedAt,
      },
    });

    await tx.indexingRun.update({
      where: { correlationId },
      data: { status: 'completed', completedAt: observedAt },
    });

    return { walletId: wallet.id, portfolioSnapshotId: snapshot.id };
  });
}

export async function failIndexingRun(correlationId: string, address: string, error: unknown) {
  const wallet = await prisma.wallet.upsert({ where: { address }, update: {}, create: { address } });
  const message = error instanceof Error ? error.message : String(error);
  await prisma.indexingRun.upsert({
    where: { correlationId },
    update: { status: 'failed', error: message, completedAt: new Date() },
    create: {
      walletId: wallet.id,
      correlationId,
      status: 'failed',
      error: message,
      completedAt: new Date(),
    },
  });
}

export async function getCurrentPortfolio(address: string) {
  return prisma.wallet.findUnique({
    where: { address },
    include: {
      positions: {
        where: { active: true },
        include: { protocol: true, assets: true },
        orderBy: { observedAt: 'desc' },
      },
      snapshots: { orderBy: { observedAt: 'desc' }, take: 1 },
      riskSnapshots: { orderBy: { observedAt: 'desc' }, take: 1 },
      indexingRuns: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
  });
}

export async function persistRiskSnapshot(input: {
  address: string;
  riskLevel: string;
  riskScoreBps: number;
  healthFactorE4?: number;
  liquidationDistanceBps?: number;
  protocolConcentrationBps: number;
  assetConcentrationBps: number;
  liquidityScoreBps: number;
  capitalAccessibilityBps: number;
  reportHash: string;
  report: Prisma.InputJsonValue;
  sourceBlock: number;
  methodologyVersion: string;
}) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { address: input.address } });
  return prisma.riskSnapshot.create({
    data: {
      walletId: wallet.id,
      riskLevel: input.riskLevel,
      riskScoreBps: input.riskScoreBps,
      healthFactorE4: input.healthFactorE4,
      liquidationDistanceBps: input.liquidationDistanceBps,
      protocolConcentrationBps: input.protocolConcentrationBps,
      assetConcentrationBps: input.assetConcentrationBps,
      liquidityScoreBps: input.liquidityScoreBps,
      capitalAccessibilityBps: input.capitalAccessibilityBps,
      reportHash: input.reportHash,
      report: toJsonValue(input.report),
      sourceBlock: BigInt(input.sourceBlock),
      methodologyVersion: input.methodologyVersion,
      observedAt: new Date(),
    },
  });
}

export async function markRiskSnapshotPublished(
  id: string,
  data: { onchainSnapshotId?: bigint; onchainTxId: string },
) {
  return prisma.riskSnapshot.update({ where: { id }, data });
}

async function upsertProtocol(
  tx: Prisma.TransactionClient,
  position: NormalizedPosition,
) {
  await tx.protocol.upsert({
    where: { id: position.protocol.id },
    update: {
      name: position.protocol.name,
      protocolType: position.protocol.type,
      contractIds: position.protocol.contracts,
    },
    create: {
      id: position.protocol.id,
      name: position.protocol.name,
      protocolType: position.protocol.type,
      contractIds: position.protocol.contracts,
    },
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function decimalOrNull(value?: string): Prisma.Decimal | null {
  return value === undefined ? null : new Prisma.Decimal(value);
}

function toPrismaPositionType(type: PositionType): PrismaPositionType {
  const mapping: Record<PositionType, PrismaPositionType> = {
    wallet: PrismaPositionType.WALLET,
    stream: PrismaPositionType.STREAM,
    lending: PrismaPositionType.LENDING,
    borrowing: PrismaPositionType.BORROWING,
    liquidity: PrismaPositionType.LIQUIDITY,
    staking: PrismaPositionType.STAKING,
    vault: PrismaPositionType.VAULT,
  };
  return mapping[type];
}

export * from '@prisma/client';

/**
 * Which enabled endpoints subscribe to this event type. Callers own the queue,
 * so this stays a plain query.
 */
export async function planDeliveries(
  type: string,
): Promise<Array<{ endpointId: string }>> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { enabled: true, events: { has: type } },
    select: { id: true },
  });
  return endpoints.map((e) => ({ endpointId: e.id }));
}

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { getCurrentPortfolio, prisma } from '@riskrail/database';
import {
  createQueue,
  createRedisConnection,
  JobName,
  QueueName,
  type PortfolioRefreshJob,
} from '@riskrail/queue';
import { isStacksPrincipal } from '@riskrail/stacks';

@Injectable()
export class PortfoliosService implements OnModuleDestroy {
  private readonly connection = createRedisConnection();
  private readonly portfolioQueue = createQueue<PortfolioRefreshJob>(QueueName.Portfolio, this.connection);

  async getPortfolio(address: string) {
    this.assertAddress(address);
    const wallet = await getCurrentPortfolio(address);
    if (!wallet) {
      return {
        address,
        status: 'not-indexed',
        positions: [],
        refresh: `/api/v1/portfolios/${address}/refresh`,
      };
    }

    const snapshot = wallet.snapshots[0];
    return {
      address,
      status: wallet.indexingRuns[0]?.status ?? 'indexed',
      lastIndexedAt: wallet.lastIndexedAt?.toISOString() ?? null,
      sourceBlock: snapshot?.blockHeight.toString() ?? null,
      totalValueUsd: snapshot?.totalValueUsd.toString() ?? '0.00',
      valuationCoverageBps: snapshot?.valuationCoverageBps ?? 0,
      byProtocol: snapshot?.protocolValues ?? {},
      byAsset: snapshot?.assetValues ?? {},
      positions: wallet.positions.map((position) => ({
        id: position.id,
        type: position.type.toLowerCase(),
        protocol: {
          id: position.protocol.id,
          name: position.protocol.name,
          type: position.protocol.protocolType,
        },
        valueUsd: position.valueUsd?.toString() ?? null,
        blockHeight: position.blockHeight.toString(),
        exact: position.exact,
        observedAt: position.observedAt.toISOString(),
        assets: position.assets.map((asset) => ({
          assetId: asset.assetId,
          symbol: asset.symbol,
          role: asset.role,
          amountAtomic: asset.amountAtomic,
          decimals: asset.decimals,
          valueUsd: asset.valueUsd?.toString() ?? null,
        })),
        details: position.raw,
      })),
    };
  }

  async getRisk(address: string) {
    this.assertAddress(address);
    const wallet = await getCurrentPortfolio(address);
    if (!wallet) throw new NotFoundException('Wallet has not been indexed yet');
    const risk = wallet.riskSnapshots[0];
    if (!risk) {
      return {
        address,
        status: 'risk-pending',
        lastIndexedAt: wallet.lastIndexedAt?.toISOString() ?? null,
      };
    }

    return {
      address,
      status: 'ready',
      riskLevel: risk.riskLevel,
      riskScoreBps: risk.riskScoreBps,
      healthFactorE4: risk.healthFactorE4,
      liquidationDistanceBps: risk.liquidationDistanceBps,
      protocolConcentrationBps: risk.protocolConcentrationBps,
      assetConcentrationBps: risk.assetConcentrationBps,
      liquidityScoreBps: risk.liquidityScoreBps,
      capitalAccessibilityBps: risk.capitalAccessibilityBps,
      reportHash: risk.reportHash,
      methodologyVersion: risk.methodologyVersion,
      sourceBlock: risk.sourceBlock.toString(),
      observedAt: risk.observedAt.toISOString(),
      onchain: risk.onchainTxId ? {
        txId: risk.onchainTxId,
        snapshotId: risk.onchainSnapshotId?.toString() ?? null,
      } : null,
      report: risk.report,
    };
  }

  async requestRefresh(address: string) {
    this.assertAddress(address);
    const correlationId = randomUUID();
    await this.portfolioQueue.add(
      JobName.PortfolioRefresh,
      {
        address,
        correlationId,
        requestedAt: new Date().toISOString(),
      },
      { jobId: `portfolio:${correlationId}` },
    );
    return {
      accepted: true,
      address,
      correlationId,
      statusUrl: `/api/v1/portfolios/${address}`,
    };
  }

  private assertAddress(address: string) {
    if (!isStacksPrincipal(address)) {
      throw new BadRequestException('A valid Stacks principal is required');
    }
  }

  async onModuleDestroy() {
    await this.portfolioQueue.close();
    await this.connection.quit();
    await prisma.$disconnect();
  }
}

import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@riskrail/database';
import {
  createQueue,
  createRedisConnection,
  JobName,
  QueueName,
  type PortfolioRefreshJob,
} from '@riskrail/queue';
import { isStacksPrincipal } from '@riskrail/stacks';
import { extractAffected, type ChainhookPayload } from './chainhook.parser.js';

/**
 * Turns a Chainhook callback into incremental indexing: only the wallets named
 * in the block get re-read, instead of polling every known wallet.
 */
@Injectable()
export class ChainhookService implements OnModuleDestroy {
  private readonly connection = createRedisConnection();
  private readonly portfolioQueue = createQueue<PortfolioRefreshJob>(
    QueueName.Portfolio,
    this.connection,
  );

  async ingest(source: string, payload: ChainhookPayload) {
    const affected = extractAffected(payload);
    const candidates = affected.addresses.filter(isStacksPrincipal);

    // Only re-index wallets RiskRail already tracks. A contract call mentions
    // plenty of principals that have never used RiskRail, and indexing those
    // would mean anyone could make us do unbounded work.
    const known = candidates.length
      ? await prisma.wallet.findMany({
          where: { address: { in: candidates } },
          select: { address: true },
        })
      : [];

    const queued: string[] = [];
    for (const wallet of known) {
      const correlationId = randomUUID();
      await this.portfolioQueue.add(
        JobName.PortfolioRefresh,
        { address: wallet.address, correlationId, requestedAt: new Date().toISOString() },
        {
          jobId: `chainhook:${source}:${wallet.address}:${affected.blockHeight ?? 'na'}`,
          // Collapse bursts: several events in one block should cause one read.
          delay: 1_500,
        },
      );
      queued.push(wallet.address);
    }

    return {
      accepted: true,
      source,
      blockHeight: affected.blockHeight ?? null,
      reorg: affected.reorg,
      seen: candidates.length,
      queued,
      receivedAt: new Date().toISOString(),
    };
  }

  async onModuleDestroy() {
    await this.portfolioQueue.close();
    await this.connection.quit();
  }
}

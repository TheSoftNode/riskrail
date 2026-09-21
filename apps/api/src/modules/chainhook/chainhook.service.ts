import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@rivisk/database';
import {
  createQueue,
  createRedisConnection,
  JobName,
  QueueName,
  type PortfolioRefreshJob,
  jobId,
} from '@rivisk/queue';
import { isStacksPrincipal } from '@rivisk/stacks';
import {
  extractAffected,
  extractRegistryConfirmations,
  type ChainhookPayload,
} from './chainhook.parser.js';

/** The worker stores whatever the broadcast returned, so match both spellings. */
const spellings = (txId: string) => [txId, `0x${txId}`];

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

    // Only re-index wallets Rivisk already tracks. A contract call mentions
    // plenty of principals that have never used Rivisk, and indexing those
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
          jobId: jobId('chainhook', source, wallet.address, affected.blockHeight ?? 'na'),
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

  /**
   * Records which on-chain snapshot id each attestation became.
   *
   * Deliberately does not re-index: publishing changes nothing about the
   * wallet, and a re-index would produce a new snapshot that the worker then
   * attests again, so every confirmation would pay for the next one.
   */
  async confirmAttestations(payload: ChainhookPayload) {
    const { confirmed, rolledBack } = extractRegistryConfirmations(payload);

    // A reorg in the same payload is applied first, so a transaction that was
    // rolled back and re-mined ends up confirmed.
    let cleared = 0;
    for (const txId of rolledBack) {
      const result = await prisma.riskSnapshot.updateMany({
        where: { onchainTxId: { in: spellings(txId) } },
        data: { onchainSnapshotId: null },
      });
      cleared += result.count;
    }

    let matched = 0;
    for (const item of confirmed) {
      const result = await prisma.riskSnapshot.updateMany({
        where: { onchainTxId: { in: spellings(item.txId) } },
        data: { onchainSnapshotId: item.snapshotId },
      });
      matched += result.count;
    }

    return {
      accepted: true,
      source: 'risk-registry',
      confirmed: confirmed.length,
      matched,
      rolledBack: rolledBack.length,
      cleared,
      receivedAt: new Date().toISOString(),
    };
  }

  async onModuleDestroy() {
    await this.portfolioQueue.close();
    await this.connection.quit();
  }
}

import type { AdapterContext, NormalizedPosition, ProtocolAdapter, ProtocolMetadata } from '@riskrail/adapter-core';

export interface BitPayReader {
  getStreamIds(address: string): Promise<number[]>;
  getStream(streamId: number): Promise<{
    sender: string;
    recipient: string;
    totalAmountAtomic: string;
    withdrawnAmountAtomic: string;
    vestedAmountAtomic: string;
    startBlock: number;
    endBlock: number;
    cancelled: boolean;
  } | null>;
}

export class BitPayAdapter implements ProtocolAdapter {
  constructor(
    private readonly reader: BitPayReader,
    private readonly contractId: string,
  ) {}

  metadata(): ProtocolMetadata {
    return {
      id: 'bitpay',
      name: 'BitPay',
      type: 'streaming-payments',
      contracts: [this.contractId],
    };
  }

  async supports(address: string): Promise<boolean> {
    return (await this.reader.getStreamIds(address)).length > 0;
  }

  async getPositions(address: string, context: AdapterContext): Promise<NormalizedPosition[]> {
    const ids = await this.reader.getStreamIds(address);
    const positions: NormalizedPosition[] = [];

    for (const streamId of ids) {
      const stream = await this.reader.getStream(streamId);
      if (!stream) continue;
      const locked = BigInt(stream.totalAmountAtomic) - BigInt(stream.withdrawnAmountAtomic);
      const withdrawable = BigInt(stream.vestedAmountAtomic) - BigInt(stream.withdrawnAmountAtomic);
      const liquid = locked > 0n ? Number((withdrawable * 10_000n) / locked) : 10_000;

      positions.push({
        id: `bitpay:${streamId}`,
        owner: address,
        protocol: this.metadata(),
        type: 'stream',
        assets: [{
          assetId: 'sBTC', symbol: 'sBTC', amountAtomic: locked.toString(), decimals: 8, role: 'locked',
        }],
        accessibility: { liquidBps: Math.max(0, Math.min(10_000, liquid)), lockedUntilBlock: stream.endBlock },
        source: { blockHeight: context.blockHeight ?? 0, observedAt: new Date().toISOString(), exact: true },
        metadata: { streamId, sender: stream.sender, recipient: stream.recipient, cancelled: stream.cancelled },
      });
    }
    return positions;
  }
}

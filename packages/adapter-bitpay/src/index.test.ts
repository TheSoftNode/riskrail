import { describe, expect, it } from 'vitest';
import { BitPayAdapter, type BitPayReader } from './index.js';

const reader: BitPayReader = {
  async getStreamIds() { return [7]; },
  async getStream() {
    return {
      sender: 'SP-SENDER',
      recipient: 'SP-RECIPIENT',
      totalAmountAtomic: '100000000',
      withdrawnAmountAtomic: '20000000',
      vestedAmountAtomic: '50000000',
      startBlock: 100,
      endBlock: 200,
      cancelled: false,
    };
  },
};

describe('BitPayAdapter', () => {
  it('normalizes outstanding and withdrawable sBTC correctly', async () => {
    const adapter = new BitPayAdapter(reader, 'ST123.bitpay-core');
    const [position] = await adapter.getPositions('SP-RECIPIENT', {
      stacksApiUrl: 'https://api.testnet.hiro.so',
      blockHeight: 150,
    });
    expect(position?.assets[0]?.amountAtomic).toBe('80000000');
    expect(position?.accessibility?.liquidBps).toBe(3750);
    expect(position?.metadata['withdrawableAmountAtomic']).toBe('30000000');
  });
});

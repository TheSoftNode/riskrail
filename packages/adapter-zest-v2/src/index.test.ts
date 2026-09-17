import { describe, expect, it } from 'vitest';
import type { ZestV2Reader } from './index.js';
import { ZestV2Adapter, ZEST_V2_MAINNET_CONTRACTS } from './index.js';

const reader: ZestV2Reader = {
  async getPosition() {
    return {
      id: 7,
      mask: '123',
      collateral: [{ aid: 2, amountAtomic: '100000000' }],
      debt: [{ aid: 6, scaledAtomic: '500000000' }],
      riskGroup: {
        mask: '123',
        borrowLtvBps: 6000,
        partialLiquidationLtvBps: 7000,
        fullLiquidationLtvBps: 7500,
      },
    };
  },
  async getAsset(assetId) {
    if (assetId === 2) return { id: 2, contractId: 'SM.sbtc', decimals: 8, symbol: 'sBTC', underlyingId: 2, zToken: false };
    return { id: 6, contractId: 'SP.usdc', decimals: 6, symbol: 'USDC', underlyingId: 6, zToken: false };
  },
  async convertSharesToUnderlying(_assetId, amount) { return amount; },
  async getActualDebt(_assetId, scaled) { return scaled; },
};

describe('ZestV2Adapter', () => {
  it('normalizes collateral and debt into one borrowing position', async () => {
    const adapter = new ZestV2Adapter(reader, ZEST_V2_MAINNET_CONTRACTS);
    const [position] = await adapter.getPositions('SPTEST', { stacksApiUrl: 'https://api.hiro.so', blockHeight: 123 });
    expect(position?.type).toBe('borrowing');
    expect(position?.assets.map((asset) => asset.role)).toEqual(['collateral', 'debt']);
    expect(position?.lending?.partialLiquidationLtvBps).toBe(7000);
    expect(position?.accessibility?.liquidBps).toBe(0);
  });
});

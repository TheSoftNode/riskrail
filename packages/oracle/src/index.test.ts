import { describe, expect, it } from 'vitest';
import { StaticPriceOracle } from './index.js';

describe('StaticPriceOracle', () => {
  it('resolves by symbol when an asset-id-specific value is absent', async () => {
    const oracle = new StaticPriceOracle({ STX: '2.5' });
    const prices = await oracle.getUsdPrices([{ assetId: 'STX', symbol: 'STX' }]);
    expect(prices.get('STX')?.priceUsd).toBe('2.5');
  });
});

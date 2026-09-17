import { describe, expect, it } from 'vitest';
import { applyPriceShocks, calculateConcentration, classifyHealthFactor } from './index.js';

describe('risk engine', () => {
  it('calculates concentration in basis points', () => {
    const result = calculateConcentration([
      { key: 'a', valueUsd: '75' },
      { key: 'b', valueUsd: '25' },
    ]);
    expect(result.topKey).toBe('a');
    expect(result.topShareBps).toBe(7500);
  });

  it('classifies collateral health deterministically', () => {
    expect(classifyHealthFactor(11_999)).toBe('critical');
    expect(classifyHealthFactor(14_000)).toBe('elevated');
    expect(classifyHealthFactor(17_000)).toBe('moderate');
    expect(classifyHealthFactor(20_000)).toBe('healthy');
  });

  it('applies price shocks without floating-point arithmetic', () => {
    expect(applyPriceShocks([{ assetId: 'BTC', valueUsd: '1000' }], [{ assetId: 'BTC', changeBps: -2000 }]))
      .toEqual([{ assetId: 'BTC', valueUsd: '800.00' }]);
  });
});

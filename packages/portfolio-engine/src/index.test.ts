import { describe, expect, it } from 'vitest';
import { atomicToDecimal, buildPortfolio, valuePositions } from './index.js';
import type { NormalizedPosition } from '@riskrail/adapter-core';

const base: NormalizedPosition = {
  id: 'native:SP1',
  owner: 'SP1',
  protocol: { id: 'native-stacks', name: 'Stacks Wallet', type: 'wallet', contracts: [] },
  type: 'wallet',
  assets: [{ assetId: 'STX', symbol: 'STX', amountAtomic: '2000000', decimals: 6, role: 'asset' }],
  source: { blockHeight: 1, observedAt: new Date(0).toISOString(), exact: true },
  metadata: {},
};

describe('portfolio valuation', () => {
  it('converts atomic values without floating point math', () => {
    expect(atomicToDecimal('123456789', 8).toString()).toBe('1.23456789');
  });

  it('values a position and builds protocol/asset totals', () => {
    const valued = valuePositions([base], new Map([['STX', { assetId: 'STX', priceUsd: '3' }]]));
    const portfolio = buildPortfolio('SP1', valued);
    expect(portfolio.totalValueUsd).toBe('6.00');
    expect(portfolio.byProtocol['native-stacks']).toBe('6.00');
    expect(portfolio.valuationCoverageBps).toBe(10_000);
  });
});

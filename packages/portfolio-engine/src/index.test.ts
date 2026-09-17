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

const lending: NormalizedPosition = {
  id: 'zest-v2:SP1:7',
  owner: 'SP1',
  protocol: { id: 'zest-v2', name: 'Zest Protocol V2', type: 'lending', contracts: [] },
  type: 'borrowing',
  assets: [
    { assetId: 'sBTC', symbol: 'sBTC', amountAtomic: '100000000', decimals: 8, role: 'collateral' },
    { assetId: 'USDC', symbol: 'USDC', amountAtomic: '50000000000', decimals: 6, role: 'debt' },
  ],
  lending: {
    borrowLtvBps: 6000,
    partialLiquidationLtvBps: 7000,
    fullLiquidationLtvBps: 7500,
  },
  accessibility: { liquidBps: 0 },
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

  it('reports partial valuation coverage at asset level', () => {
    const [valued] = valuePositions([lending], new Map([
      ['sBTC', { assetId: 'sBTC', priceUsd: '100000' }],
    ]));
    const portfolio = buildPortfolio('SP1', [valued!]);
    expect(portfolio.valuationCoverageBps).toBe(5000);
  });

  it('treats debt as negative equity and derives liquidation metrics', () => {
    const prices = new Map([
      ['sBTC', { assetId: 'sBTC', priceUsd: '100000' }],
      ['USDC', { assetId: 'USDC', priceUsd: '1' }],
    ]);
    const [valued] = valuePositions([lending], prices);
    expect(valued?.collateral?.valueUsd).toBe('100000.00000000');
    expect(valued?.debt?.valueUsd).toBe('50000.00000000');
    expect(valued?.valueUsd).toBe('50000.00000000');
    expect(valued?.collateral?.currentLtvBps).toBe(5000);
    expect(valued?.liquidation?.healthFactorE4).toBe(14000);
    expect(valued?.liquidation?.distanceBps).toBe(2857);
    expect(Number(valued?.liquidation?.priceUsd)).toBeCloseTo(71428.57142857, 5);
  });
});

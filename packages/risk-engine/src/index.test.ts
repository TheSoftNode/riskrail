import { describe, expect, it } from 'vitest';
import type { NormalizedPosition } from '@riskrail/adapter-core';
import {
  assetConcentration,
  calculateConcentration,
  calculatePortfolioRisk,
  classifyHealthFactor,
} from './index.js';

function position(overrides: Partial<NormalizedPosition> = {}): NormalizedPosition {
  return {
    id: 'p1', owner: 'SP1',
    protocol: { id: 'a', name: 'A', type: 'test', contracts: [] },
    type: 'wallet',
    assets: [{ assetId: 'STX', symbol: 'STX', amountAtomic: '1', decimals: 0, valueUsd: '60', role: 'asset' }],
    valueUsd: '60',
    source: { blockHeight: 1, observedAt: new Date(0).toISOString(), exact: true },
    metadata: {},
    ...overrides,
  };
}

describe('risk engine', () => {
  it('calculates concentration using decimal arithmetic', () => {
    const result = calculateConcentration([{ key: 'a', valueUsd: '75' }, { key: 'b', valueUsd: '25' }]);
    expect(result.topShareBps).toBe(7500);
  });

  it('classifies health-factor thresholds', () => {
    expect(classifyHealthFactor(11_999)).toBe('critical');
    expect(classifyHealthFactor(15_000)).toBe('moderate');
    expect(classifyHealthFactor(20_000)).toBe('healthy');
  });

  it('calculates asset concentration independently from protocol concentration', () => {
    const p2 = position({
      id: 'p2',
      protocol: { id: 'b', name: 'B', type: 'test', contracts: [] },
      valueUsd: '40',
      assets: [{ assetId: 'sBTC', symbol: 'sBTC', amountAtomic: '1', decimals: 0, valueUsd: '40', role: 'asset' }],
    });
    expect(assetConcentration([position(), p2]).topShareBps).toBe(6000);
  });

  it('returns a transparent composite score while retaining underlying metrics', () => {
    const result = calculatePortfolioRisk([position()]);
    expect(result.protocolConcentrationBps).toBe(0);
    expect(result.capitalAccessibilityBps).toBe(10_000);
    expect(result.riskScoreBps).toBeGreaterThan(0);
  });
});

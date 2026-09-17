import Decimal from 'decimal.js';
import type { NormalizedPosition } from '@riskrail/adapter-core';
import type { RiskLevel } from '@riskrail/shared-types';

export interface ConcentrationEntry { key: string; valueUsd: string; }
export interface ConcentrationResult { topKey?: string; topShareBps: number; totalUsd: string; }

export function calculateConcentration(entries: ConcentrationEntry[]): ConcentrationResult {
  const total = entries.reduce((acc, x) => acc.plus(x.valueUsd), new Decimal(0));
  if (total.lte(0) || entries.length === 0) return { topShareBps: 0, totalUsd: total.toFixed(2) };
  const top = entries.reduce((a, b) => new Decimal(a.valueUsd).gte(b.valueUsd) ? a : b);
  return {
    topKey: top.key,
    topShareBps: new Decimal(top.valueUsd).div(total).mul(10_000).toDecimalPlaces(0).toNumber(),
    totalUsd: total.toFixed(2),
  };
}

export function protocolConcentration(positions: NormalizedPosition[]): ConcentrationResult {
  const grouped = new Map<string, Decimal>();
  for (const position of positions) {
    if (!position.valueUsd) continue;
    grouped.set(position.protocol.id, (grouped.get(position.protocol.id) ?? new Decimal(0)).plus(position.valueUsd));
  }
  return calculateConcentration([...grouped].map(([key, value]) => ({ key, valueUsd: value.toString() })));
}

export function classifyHealthFactor(healthFactorE4?: number): RiskLevel {
  if (healthFactorE4 === undefined) return 'unknown';
  if (healthFactorE4 < 12_000) return 'critical';
  if (healthFactorE4 < 15_000) return 'elevated';
  if (healthFactorE4 < 20_000) return 'moderate';
  return 'healthy';
}

export function capitalAccessibilityBps(positions: NormalizedPosition[]): number {
  let weighted = new Decimal(0);
  let total = new Decimal(0);
  for (const p of positions) {
    if (!p.valueUsd) continue;
    const value = new Decimal(p.valueUsd);
    total = total.plus(value);
    weighted = weighted.plus(value.mul(p.accessibility?.liquidBps ?? 10_000));
  }
  return total.eq(0) ? 10_000 : weighted.div(total).toDecimalPlaces(0).toNumber();
}

export interface PriceShock { assetId: string; changeBps: number; }
export interface ValuedAsset { assetId: string; valueUsd: string; }

export function applyPriceShocks(assets: ValuedAsset[], shocks: PriceShock[]): ValuedAsset[] {
  const shockMap = new Map(shocks.map((s) => [s.assetId, s.changeBps]));
  return assets.map((asset) => {
    const change = shockMap.get(asset.assetId) ?? 0;
    const multiplier = new Decimal(10_000 + change).div(10_000);
    return { ...asset, valueUsd: new Decimal(asset.valueUsd).mul(multiplier).toFixed(2) };
  });
}

export interface PortfolioRiskSummary {
  protocolConcentrationBps: number;
  capitalAccessibilityBps: number;
  riskLevel: RiskLevel;
}

export function calculatePortfolioRisk(positions: NormalizedPosition[]): PortfolioRiskSummary {
  const concentration = protocolConcentration(positions);
  const worstHealth = positions
    .map((p) => p.liquidation?.healthFactorE4)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b)[0];
  return {
    protocolConcentrationBps: concentration.topShareBps,
    capitalAccessibilityBps: capitalAccessibilityBps(positions),
    riskLevel: classifyHealthFactor(worstHealth),
  };
}

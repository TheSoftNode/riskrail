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
  const totalPortfolio = positions.reduce(
    (total, position) => total.plus(position.valueUsd ?? 0),
    new Decimal(0),
  );
  if (totalPortfolio.lte(0)) return { topShareBps: 0, totalUsd: '0.00' };

  const grouped = new Map<string, Decimal>();
  for (const position of positions) {
    // Direct wallet balances are the base portfolio, not a DeFi protocol dependency.
    if (position.type === 'wallet' || !position.valueUsd) continue;
    grouped.set(position.protocol.id, (grouped.get(position.protocol.id) ?? new Decimal(0)).plus(position.valueUsd));
  }
  if (grouped.size === 0) return { topShareBps: 0, totalUsd: totalPortfolio.toFixed(2) };

  const [topKey, topValue] = [...grouped].reduce((a, b) => a[1].gte(b[1]) ? a : b);
  return {
    topKey,
    topShareBps: topValue.div(totalPortfolio).mul(10_000).toDecimalPlaces(0).toNumber(),
    totalUsd: totalPortfolio.toFixed(2),
  };
}

export function assetConcentration(positions: NormalizedPosition[]): ConcentrationResult {
  const grouped = new Map<string, Decimal>();
  for (const position of positions) {
    for (const asset of position.assets) {
      if (!asset.valueUsd) continue;
      grouped.set(asset.assetId, (grouped.get(asset.assetId) ?? new Decimal(0)).plus(asset.valueUsd));
    }
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
  assetConcentrationBps: number;
  capitalAccessibilityBps: number;
  liquidityScoreBps: number;
  riskScoreBps: number;
  riskLevel: RiskLevel;
  worstHealthFactorE4?: number;
  liquidationDistanceBps?: number;
}

/**
 * RiskRail v1 intentionally keeps the composite score simple and documented.
 * It is a presentation aid, not a replacement for the underlying metrics.
 *
 * - 40% collateral/health risk (when health-factor data exists)
 * - 30% protocol concentration risk
 * - 30% capital accessibility risk
 *
 * If no collateral-bearing position exists, the health component contributes zero
 * rather than pretending the system knows more than it does.
 */
export function calculatePortfolioRisk(positions: NormalizedPosition[]): PortfolioRiskSummary {
  const protocol = protocolConcentration(positions);
  const asset = assetConcentration(positions);
  const accessibility = capitalAccessibilityBps(positions);
  const worstHealth = positions
    .map((p) => p.liquidation?.healthFactorE4)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b)[0];

  const liquidationDistance = positions
    .map((p) => p.liquidation?.distanceBps)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b)[0];

  const healthRisk = healthRiskBps(worstHealth);
  const concentrationRisk = concentrationRiskBps(protocol.topShareBps);
  const accessibilityRisk = Math.max(0, 10_000 - accessibility);
  const score = Math.round(
    healthRisk * 0.4 + concentrationRisk * 0.3 + accessibilityRisk * 0.3,
  );

  return {
    protocolConcentrationBps: protocol.topShareBps,
    assetConcentrationBps: asset.topShareBps,
    capitalAccessibilityBps: accessibility,
    liquidityScoreBps: accessibility,
    riskScoreBps: Math.max(0, Math.min(10_000, score)),
    riskLevel: overallRiskLevel(worstHealth, score),
    worstHealthFactorE4: worstHealth,
    liquidationDistanceBps: liquidationDistance,
  };
}

function healthRiskBps(healthFactorE4?: number): number {
  if (healthFactorE4 === undefined) return 0;
  if (healthFactorE4 < 12_000) return 10_000;
  if (healthFactorE4 < 15_000) return 7_500;
  if (healthFactorE4 < 20_000) return 4_000;
  return 1_000;
}

function concentrationRiskBps(topShareBps: number): number {
  if (topShareBps <= 2_500) return 0;
  return Math.min(10_000, Math.round(((topShareBps - 2_500) / 7_500) * 10_000));
}

function overallRiskLevel(healthFactorE4: number | undefined, scoreBps: number): RiskLevel {
  const health = classifyHealthFactor(healthFactorE4);
  if (health !== 'unknown') return health;
  if (scoreBps >= 7_500) return 'critical';
  if (scoreBps >= 5_000) return 'elevated';
  if (scoreBps >= 2_500) return 'moderate';
  return 'healthy';
}

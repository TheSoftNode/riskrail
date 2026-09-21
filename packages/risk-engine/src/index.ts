import { Decimal } from 'decimal.js';
import type { NormalizedPosition } from '@rivisk/adapter-core';
import type { RiskLevel } from '@rivisk/shared-types';
import { deriveLendingMetrics } from '@rivisk/portfolio-engine';

export interface ConcentrationEntry { key: string; valueUsd: string; }
export interface ConcentrationResult { topKey?: string; topShareBps: number; totalUsd: string; }

export function calculateConcentration(entries: ConcentrationEntry[]): ConcentrationResult {
  const normalized = entries
    .map((entry) => ({ ...entry, value: new Decimal(entry.valueUsd).abs() }))
    .filter((entry) => entry.value.gt(0));
  const total = normalized.reduce((acc, entry) => acc.plus(entry.value), new Decimal(0));
  if (total.lte(0) || normalized.length === 0) return { topShareBps: 0, totalUsd: total.toFixed(2) };
  const top = normalized.reduce((a, b) => a.value.gte(b.value) ? a : b);
  return {
    topKey: top.key,
    topShareBps: top.value.div(total).mul(10_000).toDecimalPlaces(0).toNumber(),
    totalUsd: total.toFixed(2),
  };
}

export function protocolConcentration(positions: NormalizedPosition[]): ConcentrationResult {
  const grouped = new Map<string, Decimal>();
  let totalPortfolioGross = new Decimal(0);

  for (const position of positions) {
    const gross = getGrossExposure(position);
    totalPortfolioGross = totalPortfolioGross.plus(gross);
    // Direct wallet balances are the base portfolio, not a protocol dependency.
    if (position.type === 'wallet' || gross.lte(0)) continue;
    grouped.set(position.protocol.id, (grouped.get(position.protocol.id) ?? new Decimal(0)).plus(gross));
  }

  if (totalPortfolioGross.lte(0)) return { topShareBps: 0, totalUsd: '0.00' };
  if (grouped.size === 0) return { topShareBps: 0, totalUsd: totalPortfolioGross.toFixed(2) };

  const [topKey, topValue] = [...grouped].reduce((a, b) => a[1].gte(b[1]) ? a : b);
  return {
    topKey,
    topShareBps: topValue.div(totalPortfolioGross).mul(10_000).toDecimalPlaces(0).toNumber(),
    totalUsd: totalPortfolioGross.toFixed(2),
  };
}

export function assetConcentration(positions: NormalizedPosition[]): ConcentrationResult {
  const grouped = new Map<string, Decimal>();
  for (const position of positions) {
    for (const asset of position.assets) {
      if (!asset.valueUsd) continue;
      const value = new Decimal(asset.valueUsd).abs();
      const key = asset.symbol.toUpperCase();
      grouped.set(key, (grouped.get(key) ?? new Decimal(0)).plus(value));
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
    const gross = getGrossExposure(p);
    if (gross.lte(0)) continue;
    total = total.plus(gross);
    weighted = weighted.plus(gross.mul(p.accessibility?.liquidBps ?? 10_000));
  }
  return total.eq(0) ? 10_000 : weighted.div(total).toDecimalPlaces(0).toNumber();
}

export interface PriceShock {
  /** Either a Rivisk assetId or a symbol. Matching is case-insensitive. */
  assetId?: string;
  symbol?: string;
  /** -2000 = -20%, +500 = +5%. */
  changeBps: number;
}

export interface ValuedAsset { assetId: string; valueUsd: string; }

export function applyPriceShocks(assets: ValuedAsset[], shocks: PriceShock[]): ValuedAsset[] {
  return assets.map((asset) => {
    const shock = shocks.find((candidate) =>
      candidate.assetId?.toLowerCase() === asset.assetId.toLowerCase(),
    );
    const change = shock?.changeBps ?? 0;
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
 * Rivisk v1.1 keeps the composite score intentionally simple and public.
 * The score is a presentation aid; individual metrics remain the source of truth.
 *
 * - 40% collateral/health risk (when health-factor data exists)
 * - 30% protocol concentration risk
 * - 30% capital accessibility risk
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

export interface StressScenario {
  id?: string;
  name?: string;
  shocks: PriceShock[];
}

export interface StressPositionResult {
  positionId: string;
  protocolId: string;
  type: NormalizedPosition['type'];
  beforeValueUsd?: string;
  afterValueUsd?: string;
  beforeHealthFactorE4?: number;
  afterHealthFactorE4?: number;
  beforeLiquidationDistanceBps?: number;
  afterLiquidationDistanceBps?: number;
  liquidatableBefore: boolean;
  liquidatableAfter: boolean;
}

export interface StressScenarioResult {
  scenario: StressScenario;
  before: PortfolioRiskSummary;
  after: PortfolioRiskSummary;
  positions: StressPositionResult[];
  warnings: string[];
}

export const DEFAULT_STRESS_SCENARIOS: StressScenario[] = [
  { id: 'btc-minus-10', name: 'BTC -10%', shocks: [{ symbol: 'BTC', changeBps: -1_000 }, { symbol: 'sBTC', changeBps: -1_000 }] },
  { id: 'btc-minus-20', name: 'BTC -20%', shocks: [{ symbol: 'BTC', changeBps: -2_000 }, { symbol: 'sBTC', changeBps: -2_000 }] },
  { id: 'btc-minus-30', name: 'BTC -30%', shocks: [{ symbol: 'BTC', changeBps: -3_000 }, { symbol: 'sBTC', changeBps: -3_000 }] },
  { id: 'stx-minus-20', name: 'STX -20%', shocks: [{ symbol: 'STX', changeBps: -2_000 }] },
];

/**
 * Runs a deterministic mark-to-market stress test over already-valued positions.
 * No network calls occur here. That makes the same scenario reproducible in the
 * API, worker, SDK and tests.
 */
export function runStressScenario(
  positions: NormalizedPosition[],
  scenario: StressScenario,
): StressScenarioResult {
  const before = calculatePortfolioRisk(positions);
  const shockedPositions = positions.map((position) => stressPosition(position, scenario.shocks));
  const after = calculatePortfolioRisk(shockedPositions);
  const results: StressPositionResult[] = positions.map((position, index) => {
    const stressed = shockedPositions[index]!;
    const beforeHf = position.liquidation?.healthFactorE4;
    const afterHf = stressed.liquidation?.healthFactorE4;
    return {
      positionId: position.id,
      protocolId: position.protocol.id,
      type: position.type,
      beforeValueUsd: position.valueUsd,
      afterValueUsd: stressed.valueUsd,
      beforeHealthFactorE4: beforeHf,
      afterHealthFactorE4: afterHf,
      beforeLiquidationDistanceBps: position.liquidation?.distanceBps,
      afterLiquidationDistanceBps: stressed.liquidation?.distanceBps,
      liquidatableBefore: beforeHf !== undefined && beforeHf <= 10_000,
      liquidatableAfter: afterHf !== undefined && afterHf <= 10_000,
    };
  });

  const newlyLiquidatable = results.filter((result) => !result.liquidatableBefore && result.liquidatableAfter);
  const warnings: string[] = [];
  if (newlyLiquidatable.length > 0) {
    warnings.push(`${newlyLiquidatable.length} position(s) cross the partial-liquidation threshold in this scenario.`);
  }
  if (after.riskLevel === 'critical' && before.riskLevel !== 'critical') {
    warnings.push('Portfolio risk moves into the critical band under this scenario.');
  }

  return { scenario, before, after, positions: results, warnings };
}

export function runDefaultStressScenarios(positions: NormalizedPosition[]): StressScenarioResult[] {
  return DEFAULT_STRESS_SCENARIOS.map((scenario) => runStressScenario(positions, scenario));
}

export function stressPosition(
  position: NormalizedPosition,
  shocks: PriceShock[],
): NormalizedPosition {
  let positive = new Decimal(0);
  let debt = new Decimal(0);
  let gross = new Decimal(0);

  const assets = position.assets.map((asset) => {
    if (!asset.valueUsd) return asset;
    const shock = resolveShock(asset.assetId, asset.symbol, shocks);
    const multiplier = new Decimal(10_000 + shock).div(10_000);
    const valueUsd = new Decimal(asset.valueUsd).mul(multiplier);
    if (asset.role === 'debt') debt = debt.plus(valueUsd);
    else positive = positive.plus(valueUsd);
    gross = gross.plus(valueUsd.abs());
    return { ...asset, valueUsd: valueUsd.toFixed(8) };
  });

  const stressed: NormalizedPosition = {
    ...position,
    assets,
    valueUsd: positive.minus(debt).toFixed(8),
    metadata: {
      ...position.metadata,
      valuation: {
        ...(isRecord(position.metadata['valuation']) ? position.metadata['valuation'] : {}),
        grossExposureUsd: gross.toFixed(8),
        positiveAssetsUsd: positive.toFixed(8),
        debtUsd: debt.toFixed(8),
        stressed: true,
      },
    },
  };

  return deriveLendingMetrics(stressed);
}

function resolveShock(assetId: string, symbol: string, shocks: PriceShock[]): number {
  const byId = shocks.find((shock) => shock.assetId?.toLowerCase() === assetId.toLowerCase());
  if (byId) return byId.changeBps;
  const normalizedSymbol = symbol.toLowerCase();
  const bySymbol = shocks.find((shock) => shock.symbol?.toLowerCase() === normalizedSymbol);
  if (bySymbol) return bySymbol.changeBps;

  // BTC and sBTC are intentionally linked for common stress scenarios.
  if (['btc', 'sbtc'].includes(normalizedSymbol)) {
    return shocks.find((shock) => ['btc', 'sbtc'].includes(shock.symbol?.toLowerCase() ?? ''))?.changeBps ?? 0;
  }
  return 0;
}

function getGrossExposure(position: NormalizedPosition): Decimal {
  const valuation = position.metadata['valuation'];
  if (isRecord(valuation) && typeof valuation['grossExposureUsd'] === 'string') {
    return new Decimal(valuation['grossExposureUsd']).abs();
  }
  if (position.assets.some((asset) => asset.valueUsd)) {
    return position.assets.reduce(
      (sum, asset) => sum.plus(asset.valueUsd ? new Decimal(asset.valueUsd).abs() : 0),
      new Decimal(0),
    );
  }
  return new Decimal(position.valueUsd ?? 0).abs();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

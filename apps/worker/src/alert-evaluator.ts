import type { RiskPolicy } from '@rivisk/rivisk-contracts';

export interface MetricSnapshot {
  riskScoreBps: number;
  healthFactorE4: number | null;
  liquidationDistanceBps: number | null;
  protocolConcentrationBps: number;
  assetConcentrationBps: number;
  liquidityScoreBps: number;
  capitalAccessibilityBps: number;
}

export type ThresholdOperator = 'lt' | 'lte' | 'gt' | 'gte';

export interface PolicyCheck {
  metric: keyof MetricSnapshot;
  operator: ThresholdOperator;
  threshold: number;
}

export function metricValue(snapshot: MetricSnapshot, metric: string): number | undefined {
  if (!(metric in snapshot)) return undefined;
  const value = snapshot[metric as keyof MetricSnapshot];
  return value === null || value === undefined ? undefined : value;
}

export function compareThreshold(value: number, operator: string, threshold: number): boolean {
  if (operator === 'lt') return value < threshold;
  if (operator === 'lte') return value <= threshold;
  if (operator === 'gt') return value > threshold;
  if (operator === 'gte') return value >= threshold;
  return false;
}

export function crossedIntoBreach(
  currentValue: number | undefined,
  previousValue: number | undefined,
  operator: string,
  threshold: number,
): boolean {
  if (currentValue === undefined) return false;
  const current = compareThreshold(currentValue, operator, threshold);
  const previous = previousValue === undefined ? false : compareThreshold(previousValue, operator, threshold);
  return current && !previous;
}

export function policyChecks(policy: RiskPolicy): PolicyCheck[] {
  return [
    { metric: 'riskScoreBps', operator: 'gt', threshold: policy.maxRiskScoreBps },
    { metric: 'healthFactorE4', operator: 'lt', threshold: policy.minHealthFactorE4 },
    { metric: 'protocolConcentrationBps', operator: 'gt', threshold: policy.maxProtocolConcentrationBps },
    { metric: 'liquidityScoreBps', operator: 'lt', threshold: policy.minLiquidityScoreBps },
  ];
}

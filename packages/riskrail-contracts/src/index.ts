import { createHash } from 'node:crypto';

export interface CanonicalRiskReport {
  version: 1;
  wallet: string;
  sourceBlock: number;
  riskScoreBps: number;
  healthFactorE4?: number;
  liquidationDistanceBps?: number;
  protocolConcentrationBps: number;
  liquidityScoreBps: number;
  positionsDigest: string;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

export function canonicalizeRiskReport(report: CanonicalRiskReport): string {
  return JSON.stringify(stable(report));
}

export function hashRiskReport(report: CanonicalRiskReport): string {
  return createHash('sha256').update(canonicalizeRiskReport(report)).digest('hex');
}

export interface RiskRailContractConfig {
  riskRegistry: string;
  riskPolicy: string;
  protocolRegistry: string;
}

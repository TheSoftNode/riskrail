import Decimal from 'decimal.js';
import type { NormalizedPosition } from '@riskrail/adapter-core';

export interface Portfolio {
  owner: string;
  positions: NormalizedPosition[];
  totalValueUsd: string;
  byProtocol: Record<string, string>;
}

export function buildPortfolio(owner: string, positions: NormalizedPosition[]): Portfolio {
  const byProtocol = new Map<string, Decimal>();
  let total = new Decimal(0);
  for (const p of positions) {
    const value = new Decimal(p.valueUsd ?? 0);
    total = total.plus(value);
    byProtocol.set(p.protocol.id, (byProtocol.get(p.protocol.id) ?? new Decimal(0)).plus(value));
  }
  return {
    owner,
    positions,
    totalValueUsd: total.toFixed(2),
    byProtocol: Object.fromEntries([...byProtocol].map(([k, v]) => [k, v.toFixed(2)])),
  };
}

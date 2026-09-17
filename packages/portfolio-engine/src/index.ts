import Decimal from 'decimal.js';
import type { NormalizedPosition, PositionAsset } from '@riskrail/adapter-core';

export interface Portfolio {
  owner: string;
  positions: NormalizedPosition[];
  totalValueUsd: string;
  byProtocol: Record<string, string>;
  byAsset: Record<string, string>;
  valuationCoverageBps: number;
}

export interface PriceLike {
  assetId: string;
  priceUsd: string;
}

export function valuePositions(
  positions: NormalizedPosition[],
  prices: ReadonlyMap<string, PriceLike>,
): NormalizedPosition[] {
  return positions.map((position) => {
    let positionValue = new Decimal(0);
    let valuedAssetCount = 0;

    const assets = position.assets.map((asset) => {
      const price = prices.get(asset.assetId) ?? findPriceBySymbol(prices, asset.symbol);
      if (!price) return asset;
      const units = atomicToDecimal(asset.amountAtomic, asset.decimals);
      const valueUsd = units.mul(price.priceUsd);
      positionValue = positionValue.plus(valueUsd);
      valuedAssetCount += 1;
      return { ...asset, valueUsd: valueUsd.toFixed(8) };
    });

    return {
      ...position,
      assets,
      valueUsd: valuedAssetCount > 0 ? positionValue.toFixed(8) : position.valueUsd,
      metadata: {
        ...position.metadata,
        valuation: {
          valuedAssets: valuedAssetCount,
          totalAssets: assets.length,
        },
      },
    };
  });
}

export function buildPortfolio(owner: string, positions: NormalizedPosition[]): Portfolio {
  const byProtocol = new Map<string, Decimal>();
  const byAsset = new Map<string, Decimal>();
  let total = new Decimal(0);
  let valuedPositions = 0;

  for (const position of positions) {
    if (position.valueUsd !== undefined) {
      const value = new Decimal(position.valueUsd);
      total = total.plus(value);
      byProtocol.set(position.protocol.id, (byProtocol.get(position.protocol.id) ?? new Decimal(0)).plus(value));
      valuedPositions += 1;
    }

    for (const asset of position.assets) {
      if (!asset.valueUsd) continue;
      byAsset.set(asset.assetId, (byAsset.get(asset.assetId) ?? new Decimal(0)).plus(asset.valueUsd));
    }
  }

  return {
    owner,
    positions,
    totalValueUsd: total.toFixed(2),
    byProtocol: Object.fromEntries([...byProtocol].map(([key, value]) => [key, value.toFixed(2)])),
    byAsset: Object.fromEntries([...byAsset].map(([key, value]) => [key, value.toFixed(2)])),
    valuationCoverageBps: positions.length === 0 ? 10_000 : Math.round((valuedPositions / positions.length) * 10_000),
  };
}

export function atomicToDecimal(amountAtomic: string, decimals: number): Decimal {
  return new Decimal(amountAtomic).div(new Decimal(10).pow(decimals));
}

function findPriceBySymbol(
  prices: ReadonlyMap<string, PriceLike>,
  symbol: string,
): PriceLike | undefined {
  const normalized = symbol.toUpperCase();
  for (const quote of prices.values()) {
    if (quote.assetId.toUpperCase() === normalized) return quote;
  }
  return undefined;
}

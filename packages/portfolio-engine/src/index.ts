import Decimal from 'decimal.js';
import type { NormalizedPosition } from '@riskrail/adapter-core';

export interface Portfolio {
  owner: string;
  positions: NormalizedPosition[];
  /** Net portfolio equity after subtracting debt positions. */
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
  return positions.map((position) => valuePosition(position, prices));
}

export function valuePosition(
  position: NormalizedPosition,
  prices: ReadonlyMap<string, PriceLike>,
): NormalizedPosition {
  let positiveValue = new Decimal(0);
  let debtValue = new Decimal(0);
  let grossExposure = new Decimal(0);
  let valuedAssetCount = 0;

  const assets = position.assets.map((asset) => {
    const price = prices.get(asset.assetId) ?? findPriceBySymbol(prices, asset.symbol);
    if (!price) return asset;

    const units = atomicToDecimal(asset.amountAtomic, asset.decimals);
    const valueUsd = units.mul(price.priceUsd);
    grossExposure = grossExposure.plus(valueUsd.abs());
    if (asset.role === 'debt') debtValue = debtValue.plus(valueUsd);
    else positiveValue = positiveValue.plus(valueUsd);
    valuedAssetCount += 1;

    return { ...asset, valueUsd: valueUsd.toFixed(8) };
  });

  let valued: NormalizedPosition = {
    ...position,
    assets,
    valueUsd: valuedAssetCount > 0
      ? positiveValue.minus(debtValue).toFixed(8)
      : position.valueUsd,
    metadata: {
      ...position.metadata,
      valuation: {
        valuedAssets: valuedAssetCount,
        totalAssets: assets.length,
        grossExposureUsd: grossExposure.toFixed(8),
        positiveAssetsUsd: positiveValue.toFixed(8),
        debtUsd: debtValue.toFixed(8),
      },
    },
  };

  valued = deriveLendingMetrics(valued, prices);
  return valued;
}

/**
 * Derives protocol-independent lending metrics once collateral/debt assets have
 * been valued. Adapters provide the protocol's own LTV thresholds; this function
 * does the arithmetic and keeps the same formulas across integrations.
 */
export function deriveLendingMetrics(
  position: NormalizedPosition,
  prices?: ReadonlyMap<string, PriceLike>,
): NormalizedPosition {
  if (!position.lending) return position;

  const collateralAssets = position.assets.filter((asset) => asset.role === 'collateral' && asset.valueUsd);
  const debtAssets = position.assets.filter((asset) => asset.role === 'debt' && asset.valueUsd);
  if (collateralAssets.length === 0 || debtAssets.length === 0) return position;

  const collateralUsd = collateralAssets.reduce(
    (sum, asset) => sum.plus(asset.valueUsd ?? 0),
    new Decimal(0),
  );
  const debtUsd = debtAssets.reduce(
    (sum, asset) => sum.plus(asset.valueUsd ?? 0),
    new Decimal(0),
  );

  if (collateralUsd.lte(0) || debtUsd.lte(0)) return position;

  const currentLtvBps = debtUsd.div(collateralUsd).mul(10_000).toDecimalPlaces(0).toNumber();
  const borrowThreshold = position.lending.borrowLtvBps;
  const partialThreshold = position.lending.partialLiquidationLtvBps;
  const fullThreshold = position.lending.fullLiquidationLtvBps;

  const healthFactorE4 = partialThreshold && partialThreshold > 0
    ? new Decimal(partialThreshold).div(currentLtvBps || 1).mul(10_000).toDecimalPlaces(0).toNumber()
    : undefined;

  // Percentage collateral-price decline before the position reaches the partial
  // liquidation threshold. For a single collateral asset this maps directly to
  // liquidation-price distance; for multi-collateral positions it is a portfolio
  // approximation and is labelled as such in metadata.
  const distanceBps = partialThreshold && partialThreshold > 0
    ? new Decimal(1)
        .minus(new Decimal(currentLtvBps).div(partialThreshold))
        .mul(10_000)
        .toDecimalPlaces(0)
        .toNumber()
    : undefined;

  const liquidationPriceUsd = partialThreshold && collateralAssets.length === 1
    ? estimateSingleCollateralLiquidationPrice(
        collateralAssets[0]!,
        debtUsd,
        partialThreshold,
        prices,
      )
    : undefined;

  return {
    ...position,
    collateral: {
      valueUsd: collateralUsd.toFixed(8),
      ratioE4: currentLtvBps,
      currentLtvBps,
      borrowHeadroomBps: borrowThreshold === undefined
        ? undefined
        : Math.max(0, borrowThreshold - currentLtvBps),
    },
    debt: { valueUsd: debtUsd.toFixed(8) },
    liquidation: {
      ...position.liquidation,
      thresholdE4: partialThreshold,
      partialThresholdBps: partialThreshold,
      fullThresholdBps: fullThreshold,
      healthFactorE4,
      distanceBps: distanceBps === undefined ? undefined : Math.max(-10_000, Math.min(10_000, distanceBps)),
      priceUsd: liquidationPriceUsd,
    },
  };
}

export function buildPortfolio(owner: string, positions: NormalizedPosition[]): Portfolio {
  const byProtocol = new Map<string, Decimal>();
  const byAsset = new Map<string, Decimal>();
  let total = new Decimal(0);
  let totalAssets = 0;
  let valuedAssets = 0;

  for (const position of positions) {
    if (position.valueUsd !== undefined) {
      const value = new Decimal(position.valueUsd);
      total = total.plus(value);
      byProtocol.set(position.protocol.id, (byProtocol.get(position.protocol.id) ?? new Decimal(0)).plus(value));
    }

    for (const asset of position.assets) {
      totalAssets += 1;
      if (!asset.valueUsd) continue;
      valuedAssets += 1;
      const signed = asset.role === 'debt'
        ? new Decimal(asset.valueUsd).negated()
        : new Decimal(asset.valueUsd);
      byAsset.set(asset.assetId, (byAsset.get(asset.assetId) ?? new Decimal(0)).plus(signed));
    }
  }

  return {
    owner,
    positions,
    totalValueUsd: total.toFixed(2),
    byProtocol: Object.fromEntries([...byProtocol].map(([key, value]) => [key, value.toFixed(2)])),
    byAsset: Object.fromEntries([...byAsset].map(([key, value]) => [key, value.toFixed(2)])),
    // Coverage is asset-level. A lending position with priced collateral but an
    // unpriced debt asset must not be reported as 100% valued merely because the
    // position itself has a partial USD value.
    valuationCoverageBps: totalAssets === 0
      ? 10_000
      : Math.round((valuedAssets / totalAssets) * 10_000),
  };
}

export function atomicToDecimal(amountAtomic: string, decimals: number): Decimal {
  return new Decimal(amountAtomic).div(new Decimal(10).pow(decimals));
}

function estimateSingleCollateralLiquidationPrice(
  asset: NormalizedPosition['assets'][number],
  debtUsd: Decimal,
  partialThresholdBps: number,
  prices?: ReadonlyMap<string, PriceLike>,
): string | undefined {
  const units = atomicToDecimal(asset.amountAtomic, asset.decimals);
  if (units.lte(0)) return undefined;

  // debt / (units * threshold fraction)
  const threshold = new Decimal(partialThresholdBps).div(10_000);
  if (threshold.lte(0)) return undefined;
  const estimate = debtUsd.div(units.mul(threshold));

  // If a price map was provided, only return the estimate when the current asset
  // has a price. This prevents presenting a liquidation price on partially-valued data.
  if (prices && !prices.get(asset.assetId) && !findPriceBySymbol(prices, asset.symbol)) return undefined;
  return estimate.toFixed(8);
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

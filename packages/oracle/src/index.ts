import { Decimal } from 'decimal.js';
import { z } from 'zod';

export interface PriceQuote {
  assetId: string;
  symbol: string;
  priceUsd: string;
  source: string;
  observedAt: string;
}

export interface PriceOracle {
  getUsdPrices(assets: Array<{ assetId: string; symbol: string }>, signal?: AbortSignal): Promise<Map<string, PriceQuote>>;
}

const CoinGeckoResponseSchema = z.record(
  z.string(),
  z.object({ usd: z.number().nonnegative() }),
);

const DEFAULT_COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  SBTC: 'bitcoin',
  STX: 'blockstack',
  USDC: 'usd-coin',
  USDCX: 'usd-coin',
};

export class CoinGeckoPriceOracle implements PriceOracle {
  constructor(
    private readonly baseUrl = 'https://api.coingecko.com/api/v3',
    private readonly apiKey?: string,
    private readonly idMap: Record<string, string> = DEFAULT_COINGECKO_IDS,
  ) {}

  async getUsdPrices(
    assets: Array<{ assetId: string; symbol: string }>,
    signal?: AbortSignal,
  ): Promise<Map<string, PriceQuote>> {
    const mapped = new Map<string, string>();
    for (const asset of assets) {
      const id = this.resolveId(asset);
      if (id) mapped.set(asset.assetId, id);
    }

    const ids = [...new Set(mapped.values())];
    if (ids.length === 0) return new Map();

    const params = new URLSearchParams({ ids: ids.join(','), vs_currencies: 'usd' });
    const headers: HeadersInit = { accept: 'application/json' };
    if (this.apiKey) headers['x-cg-demo-api-key'] = this.apiKey;

    const response = await fetch(`${this.baseUrl}/simple/price?${params}`, { headers, signal });
    if (!response.ok) throw new Error(`CoinGecko price request failed with HTTP ${response.status}`);
    const body = CoinGeckoResponseSchema.parse(await response.json());
    const observedAt = new Date().toISOString();
    const result = new Map<string, PriceQuote>();

    for (const asset of assets) {
      const id = mapped.get(asset.assetId);
      const price = id ? body[id]?.usd : undefined;
      if (price === undefined) continue;
      result.set(asset.assetId, {
        assetId: asset.assetId,
        symbol: asset.symbol,
        priceUsd: new Decimal(price).toFixed(8),
        source: 'coingecko',
        observedAt,
      });
    }

    return result;
  }

  private resolveId(asset: { assetId: string; symbol: string }): string | undefined {
    const symbol = asset.symbol.toUpperCase();
    if (this.idMap[symbol]) return this.idMap[symbol];
    if (asset.assetId.toLowerCase().includes('sbtc')) return 'bitcoin';
    return undefined;
  }
}

export class StaticPriceOracle implements PriceOracle {
  constructor(private readonly prices: Record<string, string>) {}

  async getUsdPrices(assets: Array<{ assetId: string; symbol: string }>): Promise<Map<string, PriceQuote>> {
    const observedAt = new Date().toISOString();
    const result = new Map<string, PriceQuote>();
    for (const asset of assets) {
      const value = this.prices[asset.assetId] ?? this.prices[asset.symbol.toUpperCase()];
      if (!value) continue;
      result.set(asset.assetId, {
        assetId: asset.assetId,
        symbol: asset.symbol,
        priceUsd: new Decimal(value).toString(),
        source: 'static',
        observedAt,
      });
    }
    return result;
  }
}

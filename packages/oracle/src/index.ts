export interface PriceQuote {
  assetId: string;
  priceUsd: string;
  source: string;
  observedAt: string;
  blockHeight?: number;
}

export interface PriceOracle {
  getPrice(assetId: string): Promise<PriceQuote>;
}

export class StaticPriceOracle implements PriceOracle {
  constructor(private readonly prices: Record<string, string>) {}
  async getPrice(assetId: string): Promise<PriceQuote> {
    const price = this.prices[assetId];
    if (!price) throw new Error(`No static price configured for ${assetId}`);
    return { assetId, priceUsd: price, source: 'static', observedAt: new Date().toISOString() };
  }
}

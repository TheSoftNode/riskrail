export interface RiskRailClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class RiskRailClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RiskRailClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:4000/api/v1';
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`RiskRail request failed: ${response.status}`);
    return (await response.json()) as T;
  }

  health() { return this.get<{ status: string }>('/health'); }
  portfolio(address: string) { return this.get(`/portfolios/${encodeURIComponent(address)}`); }
  risk(address: string) { return this.get(`/portfolios/${encodeURIComponent(address)}/risk`); }
}

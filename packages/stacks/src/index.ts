import { z } from 'zod';

const BalanceSchema = z.object({
  stx: z.object({ balance: z.string() }),
  fungible_tokens: z.record(z.string(), z.object({ balance: z.string() })).default({}),
  non_fungible_tokens: z.record(z.string(), z.unknown()).default({}),
});

export type AddressBalances = z.infer<typeof BalanceSchema>;

export class StacksClient {
  constructor(private readonly apiUrl: string, private readonly apiKey?: string) {}

  private headers(): HeadersInit {
    return this.apiKey ? { 'x-api-key': this.apiKey } : {};
  }

  async getAddressBalances(address: string, signal?: AbortSignal): Promise<AddressBalances> {
    const response = await fetch(
      `${this.apiUrl}/extended/v1/address/${encodeURIComponent(address)}/balances`,
      { headers: this.headers(), signal },
    );
    if (!response.ok) {
      throw new Error(`Stacks API balance request failed: ${response.status}`);
    }
    return BalanceSchema.parse(await response.json());
  }

  async getCurrentBlockHeight(signal?: AbortSignal): Promise<number> {
    const response = await fetch(`${this.apiUrl}/v2/info`, {
      headers: this.headers(),
      signal,
    });
    if (!response.ok) return 0;
    const body = (await response.json()) as Record<string, unknown>;
    const height = body['stacks_tip_height'];
    return typeof height === 'number' ? height : 0;
  }
}

export function isStacksPrincipal(value: string): boolean {
  return /^(SP|ST)[0-9A-HJKMNP-TV-Z]{38,41}(\.[a-zA-Z][a-zA-Z0-9-_]{0,39})?$/.test(value);
}

import { validateStacksAddress } from '@stacks/transactions';
import { networkFromName } from '@stacks/network';
import {
  cvToJSON,
  fetchCallReadOnlyFunction,
  type ClarityValue,
} from '@stacks/transactions';
import { z } from 'zod';

const StxBalanceSchema = z.object({
  balance: z.string(),
  available: z.string(),
  locked: z.object({ amount: z.string() }).nullable().optional(),
  mempool: z.object({
    estimated_balance: z.string(),
    inbound: z.string(),
    outbound: z.string(),
  }).nullable().optional(),
});

const FtBalanceSchema = z.object({
  asset_identifier: z.string(),
  balance: z.string(),
});

const FtBalancePageSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  cursor: z.object({
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    current: z.string().nullable().optional(),
  }).optional(),
  results: z.array(FtBalanceSchema),
});

const LegacyBalanceSchema = z.object({
  stx: z.object({ balance: z.string() }),
  fungible_tokens: z.record(z.string(), z.object({ balance: z.string() })).default({}),
  non_fungible_tokens: z.record(z.string(), z.unknown()).default({}),
});

const TokenMetadataSchema = z.object({
  asset_identifier: z.string().optional(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().int().min(0).max(255).optional(),
  image_uri: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export interface FungibleTokenBalance {
  assetIdentifier: string;
  balance: string;
}

export interface AddressBalances {
  stx: {
    balance: string;
    available: string;
    locked: string;
  };
  fungibleTokens: FungibleTokenBalance[];
}

export interface FungibleTokenMetadata {
  assetIdentifier: string;
  contractId: string;
  tokenName: string;
  name: string;
  symbol: string;
  decimals: number;
  imageUri?: string;
  description?: string;
  exact: boolean;
}

export type StacksNetworkName = 'mainnet' | 'testnet' | 'devnet';

export class StacksApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'StacksApiError';
  }
}

export class StacksClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey?: string,
    readonly network: StacksNetworkName = inferNetworkFromApiUrl(apiUrl),
  ) {}

  private headers(): HeadersInit {
    return {
      accept: 'application/json',
      ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
    };
  }

  private async json(url: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(url, { headers: this.headers(), signal });
    if (!response.ok) {
      throw new StacksApiError(
        `Stacks API request failed with HTTP ${response.status}`,
        response.status,
        url,
      );
    }
    return response.json();
  }

  async getAddressBalances(address: string, signal?: AbortSignal): Promise<AddressBalances> {
    // Prefer the current v3 principal balance endpoints. The fallback keeps Rivisk
    // compatible with providers that have not exposed v3 yet.
    try {
      const [stxBody, ftBalances] = await Promise.all([
        this.json(
          `${this.apiUrl}/extended/v3/principals/${encodeURIComponent(address)}/balances/stx`,
          signal,
        ),
        this.getAllFungibleTokenBalances(address, signal),
      ]);
      const stx = StxBalanceSchema.parse(stxBody);
      return {
        stx: {
          balance: stx.balance,
          available: stx.available,
          locked: stx.locked?.amount ?? '0',
        },
        fungibleTokens: ftBalances,
      };
    } catch (error) {
      if (error instanceof StacksApiError && error.status !== 404) throw error;
      const legacy = LegacyBalanceSchema.parse(
        await this.json(
          `${this.apiUrl}/extended/v1/address/${encodeURIComponent(address)}/balances`,
          signal,
        ),
      );
      return {
        stx: {
          balance: legacy.stx.balance,
          available: legacy.stx.balance,
          locked: '0',
        },
        fungibleTokens: Object.entries(legacy.fungible_tokens).map(([assetIdentifier, row]) => ({
          assetIdentifier,
          balance: row.balance,
        })),
      };
    }
  }

  async getAllFungibleTokenBalances(
    address: string,
    signal?: AbortSignal,
  ): Promise<FungibleTokenBalance[]> {
    const results: FungibleTokenBalance[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ limit: '200' });
      if (cursor) params.set('cursor', cursor);
      const body = await this.json(
        `${this.apiUrl}/extended/v3/principals/${encodeURIComponent(address)}/balances/ft?${params}`,
        signal,
      );
      const page = FtBalancePageSchema.parse(body);
      results.push(
        ...page.results.map((row) => ({
          assetIdentifier: row.asset_identifier,
          balance: row.balance,
        })),
      );
      cursor = page.cursor?.next ?? undefined;
    } while (cursor);

    return results;
  }

  async getFungibleTokenMetadata(
    assetIdentifier: string,
    signal?: AbortSignal,
  ): Promise<FungibleTokenMetadata> {
    const { contractId, tokenName } = parseAssetIdentifier(assetIdentifier);

    // sBTC is always 8 decimals. Keeping this fallback makes the portfolio usable
    // even if token metadata is temporarily unavailable.
    const isSbtc = tokenName.toLowerCase().includes('sbtc') || contractId.toLowerCase().includes('sbtc');

    try {
      const body = TokenMetadataSchema.parse(
        await this.json(`${this.apiUrl}/metadata/v1/ft/${encodeURIComponent(contractId)}`, signal),
      );
      return {
        assetIdentifier,
        contractId,
        tokenName,
        name: body.name ?? tokenName,
        symbol: body.symbol ?? tokenName,
        decimals: body.decimals ?? (isSbtc ? 8 : 0),
        imageUri: body.image_uri ?? undefined,
        description: body.description ?? undefined,
        exact: body.decimals !== undefined,
      };
    } catch (error) {
      if (error instanceof StacksApiError && ![404, 422, 503].includes(error.status ?? 0)) throw error;
      return {
        assetIdentifier,
        contractId,
        tokenName,
        name: isSbtc ? 'sBTC' : tokenName,
        symbol: isSbtc ? 'sBTC' : tokenName,
        decimals: isSbtc ? 8 : 0,
        exact: isSbtc,
      };
    }
  }

  async getCurrentBlockHeight(signal?: AbortSignal): Promise<number> {
    const body = (await this.json(`${this.apiUrl}/v2/info`, signal)) as Record<string, unknown>;
    const height = body['stacks_tip_height'];
    if (typeof height === 'number') return height;
    if (typeof height === 'string') return Number(height);
    return 0;
  }

  async callReadOnly(
    contractId: string,
    functionName: string,
    functionArgs: ClarityValue[],
    senderAddress?: string,
  ): Promise<ReturnType<typeof cvToJSON>> {
    const { address, name } = parseContractId(contractId);
    const result = await fetchCallReadOnlyFunction({
      network: networkFromName(this.network),
      contractAddress: address,
      contractName: name,
      functionName,
      functionArgs,
      senderAddress: senderAddress ?? address,
    });
    return cvToJSON(result);
  }
}

export function parseAssetIdentifier(assetIdentifier: string): {
  contractId: string;
  tokenName: string;
} {
  const split = assetIdentifier.lastIndexOf('::');
  if (split <= 0 || split === assetIdentifier.length - 2) {
    throw new Error(`Invalid Stacks asset identifier: ${assetIdentifier}`);
  }
  return {
    contractId: assetIdentifier.slice(0, split),
    tokenName: assetIdentifier.slice(split + 2),
  };
}

export function parseContractId(contractId: string): { address: string; name: string } {
  const dot = contractId.indexOf('.');
  if (dot <= 0 || dot === contractId.length - 1) {
    throw new Error(`Invalid Stacks contract ID: ${contractId}`);
  }
  return { address: contractId.slice(0, dot), name: contractId.slice(dot + 1) };
}

export function inferNetworkFromApiUrl(apiUrl: string): StacksNetworkName {
  const value = apiUrl.toLowerCase();
  if (value.includes('testnet')) return 'testnet';
  if (value.includes('localhost') || value.includes('127.0.0.1')) return 'devnet';
  return 'mainnet';
}

/**
 * Shape *and* c32 checksum.
 *
 * The shape check alone lets a mistyped address through the API, which then
 * becomes a queued job that fails four times deep in the indexer with
 * "Invalid c32check string: checksum mismatch". Validating the checksum at the
 * boundary turns that into a clean 400 and keeps the queue free of work that
 * can never succeed.
 */
export function isStacksPrincipal(value: string): boolean {
  if (!/^(SP|ST|SM|SN)[0-9A-HJKMNP-TV-Z]{38,41}(\.[a-zA-Z][a-zA-Z0-9-_]{0,39})?$/.test(value)) {
    return false;
  }
  const [address] = value.split('.');
  return address !== undefined && validateStacksAddress(address);
}

export * from './clarity.js';

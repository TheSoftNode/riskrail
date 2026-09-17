import type {
  AdapterContext,
  LendingRiskParameters,
  NormalizedPosition,
  PositionAsset,
  ProtocolAdapter,
  ProtocolMetadata,
} from '@riskrail/adapter-core';
import { StacksClient } from '@riskrail/stacks';
import { principalCV, uintCV } from '@stacks/transactions';

const MAX_U128 = 340282366920938463463374607431768211455n;
const INDEX_PRECISION = 1_000_000_000_000n;

/**
 * Current Zest V2 market deployment used by the adapter when mainnet mode is
 * explicitly enabled. Every address can be overridden through environment
 * variables so RiskRail does not hard-code a protocol upgrade into application
 * logic.
 */
export const ZEST_V2_MAINNET_DEPLOYER = 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7';

export const ZEST_V2_MAINNET_CONTRACTS: ZestV2Contracts = {
  market: `${ZEST_V2_MAINNET_DEPLOYER}.v0-8-market`,
  marketVault: `${ZEST_V2_MAINNET_DEPLOYER}.v0-market-vault`,
  assets: `${ZEST_V2_MAINNET_DEPLOYER}.v0-assets`,
  egroup: `${ZEST_V2_MAINNET_DEPLOYER}.v0-egroup`,
  vaults: {
    0: `${ZEST_V2_MAINNET_DEPLOYER}.v0-vault-stx`,
    2: `${ZEST_V2_MAINNET_DEPLOYER}.v0-vault-sbtc`,
    4: `${ZEST_V2_MAINNET_DEPLOYER}.v0-vault-ststx`,
    6: `${ZEST_V2_MAINNET_DEPLOYER}.v0-vault-usdc`,
    8: `${ZEST_V2_MAINNET_DEPLOYER}.v0-vault-usdh`,
    10: `${ZEST_V2_MAINNET_DEPLOYER}.v0-vault-ststxbtc`,
    12: `${ZEST_V2_MAINNET_DEPLOYER}.v0-vault-stbtc`,
  },
};

const KNOWN_ASSETS: Record<number, { symbol: string; underlyingId: number; zToken: boolean }> = {
  0: { symbol: 'STX', underlyingId: 0, zToken: false },
  1: { symbol: 'STX', underlyingId: 0, zToken: true },
  2: { symbol: 'sBTC', underlyingId: 2, zToken: false },
  3: { symbol: 'sBTC', underlyingId: 2, zToken: true },
  4: { symbol: 'stSTX', underlyingId: 4, zToken: false },
  5: { symbol: 'stSTX', underlyingId: 4, zToken: true },
  6: { symbol: 'USDC', underlyingId: 6, zToken: false },
  7: { symbol: 'USDC', underlyingId: 6, zToken: true },
  8: { symbol: 'USDH', underlyingId: 8, zToken: false },
  9: { symbol: 'USDH', underlyingId: 8, zToken: true },
  10: { symbol: 'stSTXbtc', underlyingId: 10, zToken: false },
  11: { symbol: 'stSTXbtc', underlyingId: 10, zToken: true },
  12: { symbol: 'stBTC', underlyingId: 12, zToken: false },
  13: { symbol: 'stBTC', underlyingId: 12, zToken: true },
};

export interface ZestV2Contracts {
  market?: string;
  marketVault: string;
  assets: string;
  egroup: string;
  vaults: Record<number, string>;
}

export interface ZestAssetInfo {
  id: number;
  contractId: string;
  decimals: number;
  symbol: string;
  underlyingId: number;
  zToken: boolean;
}

export interface ZestCollateralEntry {
  aid: number;
  amountAtomic: string;
}

export interface ZestDebtEntry {
  aid: number;
  scaledAtomic: string;
}

export interface ZestRiskGroup extends LendingRiskParameters {
  mask: string;
}

export interface ZestPositionState {
  id: number;
  mask: string;
  collateral: ZestCollateralEntry[];
  debt: ZestDebtEntry[];
  riskGroup: ZestRiskGroup;
}

export interface ZestV2Reader {
  getPosition(address: string): Promise<ZestPositionState | null>;
  getAsset(assetId: number): Promise<ZestAssetInfo>;
  convertSharesToUnderlying(assetId: number, amountAtomic: string): Promise<string>;
  getActualDebt(assetId: number, scaledAtomic: string): Promise<string>;
}

export class StacksZestV2Reader implements ZestV2Reader {
  private readonly client: StacksClient;

  constructor(
    stacksApiUrl: string,
    private readonly contracts: ZestV2Contracts,
    apiKey?: string,
  ) {
    this.client = new StacksClient(stacksApiUrl, apiKey);
  }

  async getPosition(address: string): Promise<ZestPositionState | null> {
    const raw = await this.client.callReadOnly(
      this.contracts.marketVault,
      'get-position',
      [principalCV(address), uintCV(MAX_U128)],
      address,
    );
    const response = unwrapResponse(raw);
    if (!response.ok) return null;
    const tuple = asRecord(response.value);
    const mask = asUintString(tuple['mask']);
    const riskGroup = await this.getRiskGroup(mask, address);

    return {
      id: asNumber(tuple['id']),
      mask,
      collateral: asList(tuple['collateral']).map((entry) => {
        const item = asRecord(entry);
        return { aid: asNumber(item['aid']), amountAtomic: asUintString(item['amount']) };
      }),
      debt: asList(tuple['debt']).map((entry) => {
        const item = asRecord(entry);
        return { aid: asNumber(item['aid']), scaledAtomic: asUintString(item['scaled']) };
      }),
      riskGroup,
    };
  }

  async getAsset(assetId: number): Promise<ZestAssetInfo> {
    const raw = await this.client.callReadOnly(
      this.contracts.assets,
      'lookup',
      [uintCV(assetId)],
      undefined,
    );
    const response = unwrapResponse(raw);
    if (!response.ok) throw new Error(`Zest asset ${assetId} is not registered`);
    const tuple = asRecord(response.value);
    const known = KNOWN_ASSETS[assetId];
    const contractId = asString(tuple['addr']);
    return {
      id: assetId,
      contractId,
      decimals: asNumber(tuple['decimals']),
      symbol: known?.symbol ?? `ZEST-${assetId}`,
      underlyingId: known?.underlyingId ?? assetId,
      zToken: known?.zToken ?? false,
    };
  }

  async convertSharesToUnderlying(assetId: number, amountAtomic: string): Promise<string> {
    const asset = KNOWN_ASSETS[assetId];
    if (!asset?.zToken) return amountAtomic;
    const vault = this.contracts.vaults[asset.underlyingId];
    if (!vault) throw new Error(`No Zest vault configured for zToken asset ${assetId}`);
    const raw = await this.client.callReadOnly(
      vault,
      'convert-to-assets',
      [uintCV(BigInt(amountAtomic))],
      undefined,
    );
    const response = unwrapResponse(raw);
    if (!response.ok) throw new Error(`Could not convert Zest shares for asset ${assetId}`);
    return asUintString(response.value);
  }

  async getActualDebt(assetId: number, scaledAtomic: string): Promise<string> {
    const known = KNOWN_ASSETS[assetId];
    const underlyingId = known?.underlyingId ?? assetId;
    const vault = this.contracts.vaults[underlyingId];
    if (!vault) throw new Error(`No Zest vault configured for debt asset ${assetId}`);

    const raw = await this.client.callReadOnly(vault, 'get-next-index', [], undefined);
    const response = unwrapResponse(raw);
    if (!response.ok) throw new Error(`Could not read Zest borrow index for asset ${assetId}`);
    const nextIndex = BigInt(asUintString(response.value));
    const numerator = BigInt(scaledAtomic) * nextIndex;
    return ((numerator + INDEX_PRECISION - 1n) / INDEX_PRECISION).toString();
  }

  private async getRiskGroup(mask: string, senderAddress: string): Promise<ZestRiskGroup> {
    const raw = await this.client.callReadOnly(
      this.contracts.egroup,
      'resolve',
      [uintCV(BigInt(mask))],
      senderAddress,
    );
    const response = unwrapResponse(raw);
    if (!response.ok) {
      return { mask };
    }
    const tuple = asRecord(response.value);
    return {
      mask,
      borrowLtvBps: bufferToNumber(tuple['LTV-BORROW']),
      partialLiquidationLtvBps: bufferToNumber(tuple['LTV-LIQ-PARTIAL']),
      fullLiquidationLtvBps: bufferToNumber(tuple['LTV-LIQ-FULL']),
      liquidationPenaltyMinBps: bufferToNumber(tuple['LIQ-PENALTY-MIN']),
      liquidationPenaltyMaxBps: bufferToNumber(tuple['LIQ-PENALTY-MAX']),
    };
  }
}

export class ZestV2Adapter implements ProtocolAdapter {
  constructor(
    private readonly reader: ZestV2Reader,
    private readonly contracts: ZestV2Contracts,
  ) {}

  metadata(): ProtocolMetadata {
    return {
      id: 'zest-v2',
      name: 'Zest Protocol V2',
      type: 'lending',
      website: 'https://www.zestprotocol.com',
      contracts: [
        this.contracts.market,
        this.contracts.marketVault,
        this.contracts.assets,
        this.contracts.egroup,
        ...Object.values(this.contracts.vaults),
      ].filter((value): value is string => Boolean(value)),
    };
  }

  async supports(address: string): Promise<boolean> {
    return (await this.reader.getPosition(address)) !== null;
  }

  async getPositions(address: string, context: AdapterContext): Promise<NormalizedPosition[]> {
    const state = await this.reader.getPosition(address);
    if (!state) return [];

    const assets: PositionAsset[] = [];
    const protocolAssets: Array<Record<string, unknown>> = [];

    for (const collateral of state.collateral) {
      const info = await this.reader.getAsset(collateral.aid);
      const amountAtomic = await this.reader.convertSharesToUnderlying(collateral.aid, collateral.amountAtomic);
      const underlyingInfo = info.zToken
        ? await this.reader.getAsset(info.underlyingId)
        : info;

      assets.push({
        assetId: canonicalAssetId(underlyingInfo.symbol, underlyingInfo.contractId),
        protocolAssetId: info.contractId,
        symbol: underlyingInfo.symbol,
        amountAtomic,
        decimals: underlyingInfo.decimals,
        role: 'collateral',
      });
      protocolAssets.push({
        role: 'collateral',
        assetId: collateral.aid,
        protocolContract: info.contractId,
        underlyingAssetId: info.underlyingId,
        underlyingContract: underlyingInfo.contractId,
        zToken: info.zToken,
        protocolAmountAtomic: collateral.amountAtomic,
        normalizedAmountAtomic: amountAtomic,
      });
    }

    for (const debt of state.debt) {
      const info = await this.reader.getAsset(debt.aid);
      const actualDebtAtomic = await this.reader.getActualDebt(debt.aid, debt.scaledAtomic);
      const underlyingInfo = info.zToken
        ? await this.reader.getAsset(info.underlyingId)
        : info;

      assets.push({
        assetId: canonicalAssetId(underlyingInfo.symbol, underlyingInfo.contractId),
        protocolAssetId: info.contractId,
        symbol: underlyingInfo.symbol,
        amountAtomic: actualDebtAtomic,
        decimals: underlyingInfo.decimals,
        role: 'debt',
      });
      protocolAssets.push({
        role: 'debt',
        assetId: debt.aid,
        protocolContract: info.contractId,
        underlyingAssetId: info.underlyingId,
        underlyingContract: underlyingInfo.contractId,
        scaledAmountAtomic: debt.scaledAtomic,
        normalizedAmountAtomic: actualDebtAtomic,
      });
    }

    if (assets.length === 0) return [];

    return [{
      id: `zest-v2:${address}:${state.id}`,
      owner: address,
      protocol: this.metadata(),
      type: 'borrowing',
      assets,
      lending: state.riskGroup,
      accessibility: { liquidBps: 0 },
      source: {
        blockHeight: context.blockHeight ?? 0,
        observedAt: new Date().toISOString(),
        exact: true,
      },
      metadata: {
        obligationId: state.id,
        mask: state.mask,
        riskGroup: state.riskGroup,
        protocolAssets,
        collateralCustody: 'protocol-locked',
        debtAccounting: 'scaled-debt-normalized-with-next-borrow-index',
      },
    }];
  }
}

export function zestV2ContractsFromEnv(env: Record<string, string | undefined>): ZestV2Contracts {
  const defaults = env.STACKS_NETWORK === 'mainnet' ? ZEST_V2_MAINNET_CONTRACTS : undefined;
  const deployer = env.ZEST_V2_DEPLOYER || (env.STACKS_NETWORK === 'mainnet' ? ZEST_V2_MAINNET_DEPLOYER : undefined);

  const contract = (key: string, suffix: string, fallback?: string): string => {
    const explicit = env[key];
    if (explicit) return explicit;
    if (fallback) return fallback;
    if (deployer) return `${deployer}.${suffix}`;
    throw new Error(`${key} is required when Zest V2 is enabled on a non-mainnet network`);
  };

  return {
    market: contract('ZEST_V2_MARKET_CONTRACT', 'v0-8-market', defaults?.market),
    marketVault: contract('ZEST_V2_MARKET_VAULT_CONTRACT', 'v0-market-vault', defaults?.marketVault),
    assets: contract('ZEST_V2_ASSETS_CONTRACT', 'v0-assets', defaults?.assets),
    egroup: contract('ZEST_V2_EGROUP_CONTRACT', 'v0-egroup', defaults?.egroup),
    vaults: {
      0: contract('ZEST_V2_VAULT_STX', 'v0-vault-stx', defaults?.vaults[0]),
      2: contract('ZEST_V2_VAULT_SBTC', 'v0-vault-sbtc', defaults?.vaults[2]),
      4: contract('ZEST_V2_VAULT_STSTX', 'v0-vault-ststx', defaults?.vaults[4]),
      6: contract('ZEST_V2_VAULT_USDC', 'v0-vault-usdc', defaults?.vaults[6]),
      8: contract('ZEST_V2_VAULT_USDH', 'v0-vault-usdh', defaults?.vaults[8]),
      10: contract('ZEST_V2_VAULT_STSTXBTC', 'v0-vault-ststxbtc', defaults?.vaults[10]),
      12: contract('ZEST_V2_VAULT_STBTC', 'v0-vault-stbtc', defaults?.vaults[12]),
    },
  };
}

function canonicalAssetId(symbol: string, contractId: string): string {
  const normalized = symbol.toUpperCase();
  if (normalized === 'SBTC') return 'sBTC';
  if (normalized === 'STX') return 'STX';
  if (normalized === 'USDC') return 'USDC';
  if (normalized === 'USDH') return 'USDH';
  return contractId;
}

interface ResponseValue {
  ok: boolean;
  value: unknown;
}

function unwrapResponse(input: unknown): ResponseValue {
  if (!isRecord(input)) return { ok: true, value: input };
  const type = String(input['type'] ?? '').toLowerCase();
  if (type.includes('response')) {
    const success = input['success'];
    return { ok: success !== false, value: unwrapNode(input['value']) };
  }
  return { ok: true, value: unwrapNode(input) };
}

function unwrapNode(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(unwrapNode);
  if (typeof input !== 'object') return input;

  const node = input as Record<string, unknown>;
  const type = typeof node['type'] === 'string' ? node['type'].toLowerCase() : '';
  if (type.includes('optional') && (node['value'] === null || type.includes('none'))) return null;
  if (type.includes('response')) return unwrapNode(node['value']);
  if (type.includes('optional') || type.includes('list') || type.includes('tuple')) return unwrapNode(node['value']);
  if (type.includes('uint') || type.includes('int') || type.includes('principal') || type.includes('string') || type.includes('bool') || type.includes('buffer')) {
    return unwrapNode(node['value']);
  }
  if ('value' in node && Object.keys(node).length <= 3) return unwrapNode(node['value']);
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, unwrapNode(value)]));
}

function asRecord(value: unknown): Record<string, unknown> {
  const unwrapped = unwrapNode(value);
  if (!isRecord(unwrapped)) throw new Error(`Expected Clarity tuple, received ${String(unwrapped)}`);
  return unwrapped;
}

function asList(value: unknown): unknown[] {
  const unwrapped = unwrapNode(value);
  return Array.isArray(unwrapped) ? unwrapped : [];
}

function asNumber(value: unknown): number {
  const raw = asUintString(value);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Clarity integer exceeds JS safe range: ${raw}`);
  return parsed;
}

function asUintString(value: unknown): string {
  const unwrapped = unwrapNode(value);
  if (typeof unwrapped === 'bigint') return unwrapped.toString();
  if (typeof unwrapped === 'number') return Math.trunc(unwrapped).toString();
  if (typeof unwrapped === 'string') return unwrapped.replace(/^u/, '');
  throw new Error(`Expected Clarity uint, received ${String(unwrapped)}`);
}

function asString(value: unknown): string {
  const unwrapped = unwrapNode(value);
  if (typeof unwrapped === 'string') return unwrapped;
  throw new Error(`Expected Clarity string/principal, received ${String(unwrapped)}`);
}

function bufferToNumber(value: unknown): number | undefined {
  const unwrapped = unwrapNode(value);
  if (unwrapped === null || unwrapped === undefined) return undefined;
  if (typeof unwrapped === 'number') return unwrapped;
  if (typeof unwrapped !== 'string') return undefined;
  const hex = unwrapped.startsWith('0x') ? unwrapped.slice(2) : unwrapped;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return Number(unwrapped);
  return Number(BigInt(`0x${hex}`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

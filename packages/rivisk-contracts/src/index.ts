import { createHash } from 'node:crypto';
import {
  broadcastTransaction,
  Cl,
  makeContractCall,
} from '@stacks/transactions';
import { parseContractId, StacksClient, type StacksNetworkName, unwrapClarity } from '@rivisk/stacks';

export interface CanonicalRiskReport {
  version: string;
  wallet: string;
  sourceBlock: number;
  generatedAt: string;
  metrics: Record<string, unknown>;
  positions: unknown[];
  [key: string]: unknown;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

export function canonicalizeRiskReport(report: unknown): string {
  return JSON.stringify(stable(report));
}

export function hashRiskReport(report: unknown): string {
  return createHash('sha256').update(canonicalizeRiskReport(report)).digest('hex');
}

export interface RiviskContractConfig {
  riskRegistry: string;
  riskPolicy?: string;
  protocolRegistry?: string;
  network: Exclude<StacksNetworkName, 'devnet'>;
}

/**
 * No-debt sentinels, mirroring the constants in `risk-registry.clar`.
 *
 * These are deliberately the safest representable values rather than zero, so
 * that a consuming contract comparing against a threshold reaches the right
 * conclusion for a wallet that simply has no borrowings.
 */
export const HEALTH_FACTOR_UNBOUNDED = 340282366920938463463374607431768211455n;
export const LIQUIDATION_DISTANCE_MAX = 10_000;

export interface RiskAttestationInput {
  wallet: string;
  riskScoreBps: number;
  healthFactorE4?: number;
  liquidationDistanceBps?: number;
  protocolConcentrationBps: number;
  liquidityScoreBps: number;
  sourceBlock: number;
  reportHash: string;
}

export class RiskRegistryPublisher {
  constructor(
    private readonly config: RiviskContractConfig,
    private readonly senderKey: string,
  ) {}

  async publish(input: RiskAttestationInput): Promise<{ txId: string }> {
    if (!/^[0-9a-f]{64}$/i.test(input.reportHash)) {
      throw new Error('Risk report hash must be a 32-byte SHA-256 hex digest');
    }
    assertBps('riskScoreBps', input.riskScoreBps);
    assertBps('liquidationDistanceBps', input.liquidationDistanceBps ?? LIQUIDATION_DISTANCE_MAX);
    assertBps('protocolConcentrationBps', input.protocolConcentrationBps);
    assertBps('liquidityScoreBps', input.liquidityScoreBps);

    const { address, name } = parseContractId(this.config.riskRegistry);
    const transaction = await makeContractCall({
      contractAddress: address,
      contractName: name,
      functionName: 'publish-risk-snapshot',
      functionArgs: [
        Cl.principal(input.wallet),
        Cl.uint(input.riskScoreBps),
        // A wallet with no debt has no health factor and no distance to
        // liquidation. These publish as the *safest* representable values, not
        // as zero.
        //
        // Zero would be read by any consumer's natural check --
        // `(>= health-factor threshold)`, `(>= distance threshold)` -- as the
        // most dangerous possible position, so a debt-free wallet would be
        // refused a loan or trip an agent's guardrail. The registry's
        // HEALTH_FACTOR_UNBOUNDED / LIQUIDATION_DISTANCE_MAX exist so the naive
        // comparison is the correct one.
        Cl.uint(input.healthFactorE4 ?? HEALTH_FACTOR_UNBOUNDED),
        Cl.uint(input.liquidationDistanceBps ?? LIQUIDATION_DISTANCE_MAX),
        Cl.uint(input.protocolConcentrationBps),
        Cl.uint(input.liquidityScoreBps),
        Cl.uint(input.sourceBlock),
        Cl.buffer(Uint8Array.from(Buffer.from(input.reportHash, 'hex'))),
      ],
      senderKey: this.senderKey,
      network: this.config.network,
    });

    const result = await broadcastTransaction({ transaction, network: this.config.network });
    if ('error' in result && result.error) {
      throw new Error(`Risk attestation broadcast failed: ${String(result.error)}`);
    }
    if (!('txid' in result) || !result.txid) {
      throw new Error('Risk attestation broadcast returned no transaction ID');
    }
    return { txId: result.txid };
  }
}

export interface RiskPolicy {
  maxRiskScoreBps: number;
  minHealthFactorE4: number;
  maxProtocolConcentrationBps: number;
  minLiquidityScoreBps: number;
  enabled: boolean;
  updatedAt: number;
}

/**
 * Read-only client for wallet-owned Rivisk policies. It deliberately keeps
 * policy reads separate from the API controller so the same logic can be used
 * by the alert worker and future SDK methods.
 */
export class RiskPolicyReader {
  private readonly client: StacksClient;

  constructor(
    stacksApiUrl: string,
    private readonly contractId: string,
    apiKey?: string,
  ) {
    this.client = new StacksClient(stacksApiUrl, apiKey);
  }

  async getPolicy(wallet: string): Promise<RiskPolicy | null> {
    const raw = await this.client.callReadOnly(
      this.contractId,
      'get-risk-policy',
      [Cl.principal(wallet)],
      wallet,
    );
    const value = unwrapClarityJson(raw);
    if (!isRecord(value)) return null;

    return {
      maxRiskScoreBps: toSafeNumber(value['max-risk-score-bps']),
      minHealthFactorE4: toSafeNumber(value['min-health-factor-e4']),
      maxProtocolConcentrationBps: toSafeNumber(value['max-protocol-concentration-bps']),
      minLiquidityScoreBps: toSafeNumber(value['min-liquidity-score-bps']),
      enabled: Boolean(unwrapClarityJson(value['enabled'])),
      updatedAt: toSafeNumber(value['updated-at']),
    };
  }
}

// Shared Clarity decoding; the previous local copy treated any type signature
// containing the word "none" as an empty optional, which would null out a whole
// risk-policy tuple holding one.
const unwrapClarityJson = unwrapClarity;

function toSafeNumber(input: unknown): number {
  const value = unwrapClarityJson(input);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'bigint') {
    const number = Number(value);
    if (Number.isSafeInteger(number)) return number;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/^u/, '');
    const number = Number(normalized);
    if (Number.isSafeInteger(number)) return number;
  }
  throw new Error(`Expected safe Clarity integer, received ${String(value)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertBps(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${name} must be an integer between 0 and 10000`);
  }
}

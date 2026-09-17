import { createHash } from 'node:crypto';
import {
  broadcastTransaction,
  Cl,
  makeContractCall,
} from '@stacks/transactions';
import { parseContractId, type StacksNetworkName } from '@riskrail/stacks';

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

export interface RiskRailContractConfig {
  riskRegistry: string;
  riskPolicy?: string;
  protocolRegistry?: string;
  network: Exclude<StacksNetworkName, 'devnet'>;
}

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
    private readonly config: RiskRailContractConfig,
    private readonly senderKey: string,
  ) {}

  async publish(input: RiskAttestationInput): Promise<{ txId: string }> {
    if (!/^[0-9a-f]{64}$/i.test(input.reportHash)) {
      throw new Error('Risk report hash must be a 32-byte SHA-256 hex digest');
    }
    assertBps('riskScoreBps', input.riskScoreBps);
    assertBps('liquidationDistanceBps', input.liquidationDistanceBps ?? 0);
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
        // Contract v1 uses 0 as the explicit sentinel when a metric is unavailable.
        Cl.uint(input.healthFactorE4 ?? 0),
        Cl.uint(input.liquidationDistanceBps ?? 0),
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

function assertBps(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${name} must be an integer between 0 and 10000`);
  }
}

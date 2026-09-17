export type PositionType =
  | 'wallet'
  | 'stream'
  | 'lending'
  | 'borrowing'
  | 'liquidity'
  | 'staking'
  | 'vault';

export interface ProtocolMetadata {
  id: string;
  name: string;
  type: string;
  website?: string;
  contracts: string[];
}

export interface PositionAsset {
  assetId: string;
  symbol: string;
  amountAtomic: string;
  decimals: number;
  valueUsd?: string;
  role: 'asset' | 'collateral' | 'debt' | 'reward' | 'locked';
}

export interface NormalizedPosition {
  id: string;
  owner: string;
  protocol: ProtocolMetadata;
  type: PositionType;
  assets: PositionAsset[];
  valueUsd?: string;
  collateral?: { valueUsd: string; ratioE4?: number };
  debt?: { valueUsd: string };
  liquidation?: { thresholdE4?: number; priceUsd?: string; healthFactorE4?: number };
  liquidity?: { availableUsd?: string; exitPriceImpactBps?: number };
  accessibility?: { liquidBps: number; lockedUntilBlock?: number };
  source: { blockHeight: number; observedAt: string; exact: boolean };
  metadata: Record<string, unknown>;
}

export interface AdapterContext {
  stacksApiUrl: string;
  blockHeight?: number;
  signal?: AbortSignal;
}

export interface ProtocolAdapter {
  metadata(): ProtocolMetadata;
  supports(address: string, context: AdapterContext): Promise<boolean>;
  getPositions(address: string, context: AdapterContext): Promise<NormalizedPosition[]>;
}

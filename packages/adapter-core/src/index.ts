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
  /** Optional protocol-native asset identifier when RiskRail normalizes to an underlying asset. */
  protocolAssetId?: string;
}

/**
 * Lending parameters attached by a protocol adapter.
 *
 * These are protocol facts, not RiskRail opinions. The portfolio engine uses them
 * after pricing to derive health factor, LTV and liquidation distance.
 */
export interface LendingRiskParameters {
  borrowLtvBps?: number;
  partialLiquidationLtvBps?: number;
  fullLiquidationLtvBps?: number;
  liquidationPenaltyMinBps?: number;
  liquidationPenaltyMaxBps?: number;
}

export interface NormalizedPosition {
  id: string;
  owner: string;
  protocol: ProtocolMetadata;
  type: PositionType;
  assets: PositionAsset[];
  /** Net position equity where debt assets are negative. */
  valueUsd?: string;
  collateral?: {
    valueUsd: string;
    ratioE4?: number;
    currentLtvBps?: number;
    borrowHeadroomBps?: number;
  };
  debt?: { valueUsd: string };
  liquidation?: {
    thresholdE4?: number;
    priceUsd?: string;
    healthFactorE4?: number;
    distanceBps?: number;
    partialThresholdBps?: number;
    fullThresholdBps?: number;
  };
  lending?: LendingRiskParameters;
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

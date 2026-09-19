export type RiskLevel = 'healthy' | 'moderate' | 'elevated' | 'critical' | 'unknown';

export interface PortfolioAsset {
  assetId: string;
  symbol: string;
  role: string;
  amountAtomic: string;
  decimals: number;
  valueUsd: string | null;
}

export interface PortfolioPosition {
  id: string;
  type: string;
  protocol: { id: string; name: string; type: string };
  valueUsd: string | null;
  blockHeight: string;
  exact: boolean;
  observedAt: string;
  assets: PortfolioAsset[];
  details: Record<string, unknown>;
}

export interface PortfolioResponse {
  address: string;
  status: string;
  lastIndexedAt?: string | null;
  sourceBlock?: string | null;
  totalValueUsd?: string;
  valuationCoverageBps?: number;
  byProtocol?: Record<string, string>;
  byAsset?: Record<string, string>;
  positions: PortfolioPosition[];
  refresh?: string;
}

export interface RiskResponse {
  address: string;
  status: string;
  riskLevel?: RiskLevel;
  riskScoreBps?: number;
  healthFactorE4?: number | null;
  liquidationDistanceBps?: number | null;
  protocolConcentrationBps?: number;
  assetConcentrationBps?: number;
  liquidityScoreBps?: number;
  capitalAccessibilityBps?: number;
  reportHash?: string;
  methodologyVersion?: string;
  sourceBlock?: string;
  observedAt?: string;
  onchain?: { txId: string; snapshotId?: string | null } | null;
  report?: Record<string, unknown>;
}

export interface PriceShock {
  symbol?: string;
  assetId?: string;
  changeBps: number;
}

export interface StressScenario {
  name: string;
  shocks: PriceShock[];
}

export interface StressRiskSummary {
  riskLevel: RiskLevel;
  riskScoreBps: number;
  worstHealthFactorE4?: number;
  liquidationDistanceBps?: number;
  protocolConcentrationBps: number;
  assetConcentrationBps: number;
  liquidityScoreBps: number;
  capitalAccessibilityBps: number;
}

export interface StressPositionResult {
  positionId: string;
  protocolId: string;
  type: string;
  beforeValueUsd?: string;
  afterValueUsd?: string;
  beforeHealthFactorE4?: number;
  afterHealthFactorE4?: number;
  beforeLiquidationDistanceBps?: number;
  afterLiquidationDistanceBps?: number;
  liquidatableBefore: boolean;
  liquidatableAfter: boolean;
}

export interface SimulationResponse {
  address: string;
  sourceBlock: string | null;
  valuationCoverageBps: number;
  scenario: StressScenario;
  before: StressRiskSummary;
  after: StressRiskSummary;
  positions: StressPositionResult[];
  warnings: string[];
}

export type AlertMetric =
  | 'riskScoreBps'
  | 'healthFactorE4'
  | 'liquidationDistanceBps'
  | 'protocolConcentrationBps'
  | 'assetConcentrationBps'
  | 'liquidityScoreBps'
  | 'capitalAccessibilityBps';

export type AlertOperator = 'lt' | 'lte' | 'gt' | 'gte';

export interface AlertRule {
  id: string;
  metric: AlertMetric | string;
  operator: AlertOperator | string;
  threshold: string;
  channel: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  events?: AlertEvent[];
}

export interface AlertEvent {
  id: string;
  value: string;
  metadata: Record<string, unknown>;
  triggeredAt: string;
}

export interface PolicyBreachEvent {
  id: string;
  source: string;
  metric: string;
  operator: string;
  threshold: string;
  value: string;
  sourceBlock: string;
  metadata: Record<string, unknown>;
  triggeredAt: string;
}

export interface AlertsResponse {
  address: string;
  rules: AlertRule[];
  policyBreaches: PolicyBreachEvent[];
}

export interface OnchainPolicy {
  maxRiskScoreBps: number;
  minHealthFactorE4: number;
  maxProtocolConcentrationBps: number;
  minLiquidityScoreBps: number;
  enabled: boolean;
  updatedAt: number;
}

export interface PolicyResponse {
  address: string;
  configured: boolean;
  contract?: string;
  policy: OnchainPolicy | null;
  note?: string;
}

export interface RealtimeMessage {
  event: 'portfolio.updated' | 'risk.updated' | 'alert.triggered' | 'policy.breached';
  address: string;
  data: Record<string, unknown>;
  timestamp: string;
}

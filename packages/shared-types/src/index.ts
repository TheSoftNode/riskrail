export type RiskLevel = 'healthy' | 'moderate' | 'elevated' | 'critical' | 'unknown';

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface RiskSnapshotDto {
  wallet: string;
  riskScoreBps: number;
  healthFactorE4?: number;
  liquidationDistanceBps?: number;
  protocolConcentrationBps: number;
  liquidityScoreBps: number;
  sourceBlock: number;
  reportHash: string;
  observedAt: string;
}

import { IsIn, IsString, Matches } from 'class-validator';

export const ALERT_METRICS = [
  'riskScoreBps',
  'healthFactorE4',
  'liquidationDistanceBps',
  'protocolConcentrationBps',
  'assetConcentrationBps',
  'liquidityScoreBps',
  'capitalAccessibilityBps',
] as const;

export class CreateAlertDto {
  @IsIn(ALERT_METRICS)
  metric!: (typeof ALERT_METRICS)[number];

  @IsIn(['lt', 'lte', 'gt', 'gte'])
  operator!: 'lt' | 'lte' | 'gt' | 'gte';

  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  threshold!: string;

  @IsIn(['in_app'])
  channel!: 'in_app';
}

export class UpdateAlertStatusDto {
  @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED'])
  status!: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

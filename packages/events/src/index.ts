export const EventTopic = {
  PositionUpdated: 'position.updated',
  PortfolioRecalculateRequested: 'portfolio.recalculate.requested',
  PortfolioUpdated: 'portfolio.updated',
  RiskRecalculateRequested: 'risk.recalculate.requested',
  RiskUpdated: 'risk.updated',
  RiskAttestationRequested: 'risk.attestation.requested',
  AlertEvaluateRequested: 'alert.evaluate.requested',
  AlertTriggered: 'alert.triggered',
  WebhookDeliveryRequested: 'webhook.delivery.requested',
} as const;

export type EventTopicName = (typeof EventTopic)[keyof typeof EventTopic];

export interface DomainEvent<T = unknown> {
  id: string;
  topic: EventTopicName;
  occurredAt: string;
  correlationId: string;
  payload: T;
}

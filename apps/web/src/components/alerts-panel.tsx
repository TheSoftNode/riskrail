'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { riskrailApi } from '../lib/api';
import type { AlertMetric, AlertOperator } from '../lib/types';
import { formatBps, formatHealth } from './format';

const metricOptions: Array<{ value: AlertMetric; label: string; example: string }> = [
  { value: 'healthFactorE4', label: 'Health factor', example: '1.30' },
  { value: 'liquidationDistanceBps', label: 'Liquidation distance (%)', example: '15' },
  { value: 'riskScoreBps', label: 'Risk score (0-100)', example: '70' },
  { value: 'protocolConcentrationBps', label: 'Protocol concentration (%)', example: '50' },
  { value: 'liquidityScoreBps', label: 'Liquidity score (%)', example: '40' },
  { value: 'capitalAccessibilityBps', label: 'Capital accessibility (%)', example: '40' },
];

export function AlertsPanel({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: ['alerts', address], queryFn: () => riskrailApi.alerts(address) });
  const [metric, setMetric] = useState<AlertMetric>('healthFactorE4');
  const [operator, setOperator] = useState<AlertOperator>('lt');
  const [threshold, setThreshold] = useState('1.30');

  const create = useMutation({
    mutationFn: () => riskrailApi.createAlert(address, {
      metric,
      operator,
      threshold: normalizeThreshold(metric, threshold),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', address] });
    },
  });

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' }) => riskrailApi.setAlertStatus(id, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts', address] });
    },
  });

  const selectedMetric = metricOptions.find((item) => item.value === metric)!;

  return (
    <section className="panel" id="alerts">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Monitoring</span>
          <h2 className="section-title">Risk alerts</h2>
        </div>
        <span className="muted-tag">In-app beta</span>
      </div>
      <p className="panel-copy">
        Alert rules are evaluated whenever RiskRail creates a new risk snapshot. Email and webhook delivery stay disabled until authenticated accounts are added.
      </p>

      <div className="alert-builder">
        <label>
          Metric
          <select
            value={metric}
            onChange={(event) => {
              const next = event.target.value as AlertMetric;
              setMetric(next);
              setThreshold(metricOptions.find((item) => item.value === next)?.example ?? '0');
            }}
          >
            {metricOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Condition
          <select value={operator} onChange={(event) => setOperator(event.target.value as AlertOperator)}>
            <option value="lt">falls below</option>
            <option value="lte">is at or below</option>
            <option value="gt">rises above</option>
            <option value="gte">is at or above</option>
          </select>
        </label>
        <label>
          Threshold
          <input value={threshold} onChange={(event) => setThreshold(event.target.value)} inputMode="decimal" />
          <small>{selectedMetric.label}</small>
        </label>
        <button className="button button-secondary" type="button" disabled={create.isPending || !threshold} onClick={() => create.mutate()}>
          {create.isPending ? 'Saving…' : 'Add alert'}
        </button>
      </div>

      {create.error ? <p className="error-box">{create.error.message}</p> : null}

      <div className="alert-list">
        {(alerts.data?.rules ?? []).map((rule) => (
          <article className="alert-rule" key={rule.id}>
            <div>
              <strong>{humanMetric(rule.metric)}</strong>
              <span>{humanOperator(rule.operator)} {displayThreshold(rule.metric, rule.threshold)}</span>
            </div>
            <div className="alert-rule-actions">
              <span className={`status-dot status-${rule.status.toLowerCase()}`}>{rule.status.toLowerCase()}</span>
              {rule.status !== 'ARCHIVED' ? (
                <button
                  type="button"
                  className="text-button"
                  disabled={status.isPending}
                  onClick={() => status.mutate({ id: rule.id, next: rule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                >
                  {rule.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {(alerts.data?.rules.length ?? 0) === 0 ? <p className="empty-state compact">No local alert rules yet.</p> : null}
      </div>

      {(alerts.data?.policyBreaches.length ?? 0) > 0 ? (
        <div className="policy-event-list">
          <span className="eyebrow">Recent on-chain policy breaches</span>
          {alerts.data!.policyBreaches.slice(0, 5).map((event) => (
            <div className="policy-event" key={event.id}>
              <strong>{humanMetric(event.metric)}</strong>
              <span>{displayThreshold(event.metric, event.value)} crossed {humanOperator(event.operator)} {displayThreshold(event.metric, event.threshold)}</span>
              <small>{new Date(event.triggeredAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function normalizeThreshold(metric: AlertMetric, value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (metric === 'healthFactorE4') return String(Math.round(number * 10_000));
  return String(Math.round(number * 100));
}

function displayThreshold(metric: string, value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (metric === 'healthFactorE4') return formatHealth(number);
  if (metric.endsWith('Bps')) return formatBps(number);
  return value;
}

function humanMetric(metric: string) {
  return metricOptions.find((item) => item.value === metric)?.label ?? metric;
}

function humanOperator(operator: string) {
  return ({ lt: 'falls below', lte: 'is at or below', gt: 'rises above', gte: 'is at or above' } as Record<string, string>)[operator] ?? operator;
}

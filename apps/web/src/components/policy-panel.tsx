'use client';

import { useQuery } from '@tanstack/react-query';
import { riskrailApi } from '../lib/api';
import { formatBps, formatHealth, shorten } from './format';

export function PolicyPanel({ address }: { address: string }) {
  const policy = useQuery({ queryKey: ['policy', address], queryFn: () => riskrailApi.policy(address) });
  const value = policy.data?.policy;

  return (
    <section className="panel" id="policy">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">User-owned guardrails</span>
          <h2 className="section-title">On-chain risk policy</h2>
        </div>
        <span className={`status-dot ${value?.enabled ? 'status-active' : 'status-paused'}`}>
          {value?.enabled ? 'enabled' : policy.data?.configured ? 'not set' : 'contract not configured'}
        </span>
      </div>

      {!policy.data?.configured ? (
        <p className="empty-state">
          The API has no `RISK_POLICY_CONTRACT` configured yet. Deploy the RiskRail contract and set the environment variable to start evaluating wallet-owned policies.
        </p>
      ) : value ? (
        <>
          <div className="metric-grid metric-grid-4">
            <PolicyMetric label="Max risk score" value={`${(value.maxRiskScoreBps / 100).toFixed(1)}/100`} />
            <PolicyMetric label="Min health factor" value={formatHealth(value.minHealthFactorE4)} />
            <PolicyMetric label="Max protocol concentration" value={formatBps(value.maxProtocolConcentrationBps)} />
            <PolicyMetric label="Min liquidity score" value={formatBps(value.minLiquidityScoreBps)} />
          </div>
          <p className="contract-note">Policy source: {shorten(policy.data.contract, 16, 10)} · updated at block {value.updatedAt}</p>
        </>
      ) : (
        <p className="empty-state">No policy is stored for this wallet yet. RiskRail will continue using local alert rules until the wallet writes a policy on-chain.</p>
      )}
    </section>
  );
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return <div className="metric-card"><span className="metric-label">{label}</span><strong>{value}</strong></div>;
}

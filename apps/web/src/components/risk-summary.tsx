import type { RiskResponse } from '../lib/types';
import { formatBps, formatHealth, shorten } from './format';

const riskCopy: Record<string, string> = {
  healthy: 'No monitored lending position is close to the configured liquidation band.',
  moderate: 'The portfolio has measurable risk, but no immediate critical condition is detected.',
  elevated: 'At least one monitored metric deserves attention. Review the lending and stress sections.',
  critical: 'One or more monitored positions are at or beyond RiskRail\'s critical risk band.',
  unknown: 'RiskRail does not yet have enough priced data to classify this portfolio confidently.',
};

export function RiskSummary({ risk }: { risk?: RiskResponse }) {
  const level = risk?.riskLevel ?? 'unknown';
  return (
    <section className="panel risk-hero-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Portfolio risk</span>
          <h2 className="section-title">Current risk picture</h2>
        </div>
        <span className={`risk-pill risk-${level}`}>{level}</span>
      </div>

      <p className="panel-copy">{riskCopy[level] ?? riskCopy.unknown}</p>

      <div className="metric-grid metric-grid-4">
        <Metric label="Risk score" value={risk?.riskScoreBps !== undefined ? `${(risk.riskScoreBps / 100).toFixed(1)}/100` : '—'} />
        <Metric label="Health factor" value={formatHealth(risk?.healthFactorE4)} hint="Lower values mean less buffer before liquidation." />
        <Metric label="Liquidation distance" value={formatBps(risk?.liquidationDistanceBps)} />
        <Metric label="Protocol concentration" value={formatBps(risk?.protocolConcentrationBps)} />
      </div>

      <div className="attestation-strip">
        <div>
          <span className="eyebrow">Verifiable report</span>
          <strong>{risk?.reportHash ? shorten(risk.reportHash, 12, 10) : 'Not published yet'}</strong>
        </div>
        <div className="attestation-meta">
          <span>{risk?.methodologyVersion ?? 'methodology pending'}</span>
          <span>{risk?.onchain?.txId ? 'On-chain attestation broadcast' : 'Off-chain report only'}</span>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

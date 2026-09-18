import type { PortfolioResponse } from '../lib/types';
import { formatUsd } from './format';

export function PortfolioBreakdown({ portfolio }: { portfolio?: PortfolioResponse }) {
  const protocols = toRows(portfolio?.byProtocol);
  const assets = toRows(portfolio?.byAsset);
  const total = Number(portfolio?.totalValueUsd ?? 0);

  return (
    <section className="two-column-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Exposure</span>
            <h2 className="section-title">By protocol</h2>
          </div>
        </div>
        <Breakdown rows={protocols} total={total} empty="No protocol exposure has been indexed yet." />
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Assets</span>
            <h2 className="section-title">By asset</h2>
          </div>
        </div>
        <Breakdown rows={assets} total={total} empty="No priced assets have been indexed yet." />
      </article>
    </section>
  );
}

function Breakdown({ rows, total, empty }: { rows: Array<[string, number]>; total: number; empty: string }) {
  if (rows.length === 0) return <p className="empty-state">{empty}</p>;
  const denominator = Math.max(rows.reduce((sum, [, value]) => sum + Math.abs(value), 0), Math.abs(total), 1);
  return (
    <div className="breakdown-list">
      {rows.map(([key, value]) => {
        const share = Math.min(100, (Math.abs(value) / denominator) * 100);
        return (
          <div className="breakdown-row" key={key}>
            <div className="breakdown-label-row">
              <span>{key}</span>
              <strong>{formatUsd(value)}</strong>
            </div>
            <div className="progress-track"><span style={{ width: `${share}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function toRows(values?: Record<string, string>): Array<[string, number]> {
  if (!values) return [];
  return Object.entries(values)
    .map(([key, value]) => [key, Number(value)] as [string, number])
    .filter(([, value]) => Number.isFinite(value) && Math.abs(value) > 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

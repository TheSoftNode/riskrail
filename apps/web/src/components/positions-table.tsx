import type { PortfolioPosition } from '../lib/types';
import { formatBps, formatHealth, formatUsd } from './format';

export function PositionsTable({ positions }: { positions: PortfolioPosition[] }) {
  return (
    <section className="panel" id="positions">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Protocol positions</span>
          <h2 className="section-title">Where capital is deployed</h2>
        </div>
        <span className="count-badge">{positions.length}</span>
      </div>

      {positions.length === 0 ? (
        <p className="empty-state">No active positions are indexed for this address yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Type</th>
                <th>Assets</th>
                <th>Net value</th>
                <th>Health</th>
                <th>Liquidation distance</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const liquidation = asRecord(position.details.liquidation);
                return (
                  <tr key={position.id}>
                    <td>
                      <strong>{position.protocol.name}</strong>
                      <small>{position.protocol.type}</small>
                    </td>
                    <td><span className="position-type">{position.type}</span></td>
                    <td>
                      <div className="asset-chips">
                        {position.assets.slice(0, 4).map((asset, index) => (
                          <span key={`${position.id}-${asset.assetId}-${asset.role}-${index}`} className={`asset-chip role-${asset.role}`}>
                            {asset.symbol} · {asset.role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{formatUsd(position.valueUsd)}</td>
                    <td>{formatHealth(numberOrNull(liquidation.healthFactorE4))}</td>
                    <td>{formatBps(numberOrNull(liquidation.distanceBps))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

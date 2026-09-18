'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { riskrailApi } from '../lib/api';
import type { SimulationResponse, StressScenario } from '../lib/types';
import { formatBps, formatHealth } from './format';

export function StressTestPanel({ address }: { address: string }) {
  const presets = useQuery({ queryKey: ['stress-presets'], queryFn: () => riskrailApi.presets() });
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [customAsset, setCustomAsset] = useState('sBTC');
  const [customPercent, setCustomPercent] = useState('-20');

  const simulation = useMutation({
    mutationFn: (scenario: StressScenario) => riskrailApi.simulate(address, scenario.name, scenario.shocks),
    onSuccess: setResult,
  });

  const customScenario = useMemo<StressScenario>(() => ({
    name: `Custom ${customAsset} ${Number(customPercent) >= 0 ? '+' : ''}${customPercent}%`,
    shocks: [{ symbol: customAsset, changeBps: Math.round(Number(customPercent || 0) * 100) }],
  }), [customAsset, customPercent]);

  return (
    <section className="panel" id="stress-tests">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">What-if analysis</span>
          <h2 className="section-title">Stress test the portfolio</h2>
        </div>
        <span className="muted-tag">No transaction is executed</span>
      </div>
      <p className="panel-copy">
        Price shocks are deterministic scenarios. They show how the latest indexed position would look under a different market price; they are not forecasts.
      </p>

      <div className="scenario-row">
        {(presets.data ?? []).map((preset) => (
          <button
            type="button"
            className="scenario-button"
            key={preset.name}
            disabled={simulation.isPending}
            onClick={() => simulation.mutate(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="custom-scenario">
        <label>
          Asset
          <select value={customAsset} onChange={(event) => setCustomAsset(event.target.value)}>
            <option>sBTC</option>
            <option>BTC</option>
            <option>STX</option>
            <option>USDC</option>
          </select>
        </label>
        <label>
          Price change (%)
          <input type="number" min="-100" max="1000" step="1" value={customPercent} onChange={(event) => setCustomPercent(event.target.value)} />
        </label>
        <button
          type="button"
          className="button button-secondary"
          disabled={simulation.isPending || !Number.isFinite(Number(customPercent))}
          onClick={() => simulation.mutate(customScenario)}
        >
          {simulation.isPending ? 'Running…' : 'Run custom scenario'}
        </button>
      </div>

      {simulation.error ? <p className="error-box">{simulation.error.message}</p> : null}
      {result ? <SimulationResult result={result} /> : <p className="empty-state compact">Choose a scenario to compare current risk with stressed risk.</p>}
    </section>
  );
}

function SimulationResult({ result }: { result: SimulationResponse }) {
  return (
    <div className="simulation-result">
      <div className="simulation-header">
        <div>
          <span className="eyebrow">Scenario result</span>
          <strong>{result.scenario.name}</strong>
        </div>
        <span className={`risk-pill risk-${result.after.riskLevel}`}>{result.after.riskLevel}</span>
      </div>
      <div className="comparison-grid">
        <Comparison label="Health factor" before={formatHealth(result.before.worstHealthFactorE4)} after={formatHealth(result.after.worstHealthFactorE4)} />
        <Comparison label="Liquidation distance" before={formatBps(result.before.liquidationDistanceBps)} after={formatBps(result.after.liquidationDistanceBps)} />
        <Comparison label="Risk score" before={`${(result.before.riskScoreBps / 100).toFixed(1)}/100`} after={`${(result.after.riskScoreBps / 100).toFixed(1)}/100`} />
      </div>
      {result.warnings.length > 0 ? (
        <div className="warning-box">
          {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : <p className="success-box">No new critical threshold crossing was detected in this scenario.</p>}
    </div>
  );
}

function Comparison({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="comparison-card">
      <span>{label}</span>
      <div><small>Now</small><strong>{before}</strong></div>
      <div><small>After</small><strong>{after}</strong></div>
    </div>
  );
}

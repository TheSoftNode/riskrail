'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRealtime } from '../hooks/use-realtime';
import { riskrailApi } from '../lib/api';
import { connectRiskRailWallet, disconnectRiskRailWallet, restoreRiskRailWallet } from '../lib/wallet';
import { AlertsPanel } from './alerts-panel';
import { formatBps, formatUsd, shorten } from './format';
import { PolicyPanel } from './policy-panel';
import { PortfolioBreakdown } from './portfolio-breakdown';
import { PositionsTable } from './positions-table';
import { RiskSummary } from './risk-summary';
import { StressTestPanel } from './stress-test-panel';

export function DashboardClient({ initialAddress }: { initialAddress: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addressInput, setAddressInput] = useState(initialAddress);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const address = initialAddress.trim();

  useRealtime(address || null);

  useEffect(() => {
    void restoreRiskRailWallet().then(setConnectedAddress);
  }, []);

  const portfolio = useQuery({
    queryKey: ['portfolio', address],
    queryFn: () => riskrailApi.portfolio(address),
    enabled: Boolean(address),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'processing' || data?.status === 'queued' ? 2_000 : false;
    },
  });

  const risk = useQuery({
    queryKey: ['risk', address],
    queryFn: () => riskrailApi.risk(address),
    enabled: Boolean(address) && portfolio.data?.status !== 'not-indexed',
    retry: false,
  });

  const refresh = useMutation({
    mutationFn: () => riskrailApi.refresh(address),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio', address] });
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['portfolio', address] });
        void queryClient.invalidateQueries({ queryKey: ['risk', address] });
      }, 1500);
    },
  });

  const hasPortfolio = Boolean(portfolio.data && portfolio.data.status !== 'not-indexed');
  const coverage = portfolio.data?.valuationCoverageBps ?? 0;
  const total = portfolio.data?.totalValueUsd ?? '0';
  const latest = useMemo(() => {
    if (!portfolio.data?.lastIndexedAt) return 'Not indexed yet';
    return new Date(portfolio.data.lastIndexedAt).toLocaleString();
  }, [portfolio.data?.lastIndexedAt]);

  async function connectWallet() {
    const wallet = await connectRiskRailWallet();
    setConnectedAddress(wallet);
    setAddressInput(wallet);
    router.push(`/dashboard?address=${encodeURIComponent(wallet)}`);
  }

  async function disconnectWallet() {
    await disconnectRiskRailWallet();
    setConnectedAddress(null);
  }

  function inspectAddress(event: FormEvent) {
    event.preventDefault();
    const next = addressInput.trim();
    if (next) router.push(`/dashboard?address=${encodeURIComponent(next)}`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="/">
          <span className="brand-mark">R</span>
          <span><strong>RiskRail</strong><small>Bitcoin risk intelligence</small></span>
        </a>
        <nav className="side-nav">
          <a href="#overview">Overview</a>
          <a href="#positions">Positions</a>
          <a href="#stress-tests">Stress tests</a>
          <a href="#alerts">Alerts</a>
          <a href="#policy">Risk policy</a>
        </nav>
        <div className="sidebar-foot">
          <span className="network-dot" />
          <span>{process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'mainnet'}</span>
        </div>
      </aside>

      <main className="dashboard-main" id="overview">
        <header className="dashboard-topbar">
          <form className="address-bar" onSubmit={inspectAddress}>
            <span>Address</span>
            <input value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="SP… or ST…" />
            <button type="submit">Inspect</button>
          </form>
          <div className="wallet-actions">
            {connectedAddress ? (
              <button type="button" className="wallet-button" onClick={disconnectWallet}>{shorten(connectedAddress)}</button>
            ) : (
              <button type="button" className="button button-primary" onClick={() => void connectWallet()}>Connect wallet</button>
            )}
          </div>
        </header>

        <section className="dashboard-heading">
          <div>
            <span className="eyebrow">Wallet intelligence</span>
            <h1>{shorten(address, 12, 8)}</h1>
            <p>Cross-protocol portfolio state, deterministic risk metrics and verifiable reports from the latest indexed Stacks state.</p>
          </div>
          <button type="button" className="button button-secondary" disabled={refresh.isPending || !address} onClick={() => refresh.mutate()}>
            {refresh.isPending ? 'Queueing…' : 'Refresh on-chain data'}
          </button>
        </section>

        {portfolio.error ? <p className="error-box">Portfolio request failed: {portfolio.error.message}</p> : null}
        {refresh.error ? <p className="error-box">Refresh failed: {refresh.error.message}</p> : null}

        {!hasPortfolio && !portfolio.isLoading ? (
          <section className="panel onboarding-panel">
            <span className="eyebrow">First scan</span>
            <h2>This address has not been indexed yet.</h2>
            <p>RiskRail will read the wallet, enabled protocol adapters and current risk state without taking custody of funds.</p>
            <button type="button" className="button button-primary" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              {refresh.isPending ? 'Starting index…' : 'Index this address'}
            </button>
          </section>
        ) : null}

        {hasPortfolio ? (
          <>
            <section className="overview-cards">
              <div className="overview-card"><span>Net portfolio value</span><strong>{formatUsd(total)}</strong><small>Latest indexed equity</small></div>
              <div className="overview-card"><span>Valuation coverage</span><strong>{formatBps(coverage)}</strong><small>Share of gross exposure with a price</small></div>
              <div className="overview-card"><span>Active positions</span><strong>{portfolio.data?.positions.length ?? 0}</strong><small>Across wallet and protocol adapters</small></div>
              <div className="overview-card"><span>Latest index</span><strong className="small-strong">{latest}</strong><small>Source block {portfolio.data?.sourceBlock ?? '—'}</small></div>
            </section>

            <RiskSummary risk={risk.data} />
            <PortfolioBreakdown portfolio={portfolio.data} />
            <PositionsTable positions={portfolio.data?.positions ?? []} />
            <StressTestPanel address={address} />
            <section className="two-column-grid align-start">
              <AlertsPanel address={address} />
              <PolicyPanel address={address} />
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

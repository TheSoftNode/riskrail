'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { connectRiskRailWallet, restoreRiskRailWallet } from '../lib/wallet';

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    void restoreRiskRailWallet().then(setWalletAddress);
  }, []);

  function inspect(event: FormEvent) {
    event.preventDefault();
    const value = address.trim();
    if (value) router.push(`/dashboard?address=${encodeURIComponent(value)}`);
  }

  async function connectWallet() {
    try {
      setWalletError(null);
      const value = await connectRiskRailWallet();
      setWalletAddress(value);
      router.push(`/dashboard?address=${encodeURIComponent(value)}`);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Wallet connection failed.');
    }
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <a className="brand-lockup" href="/">
          <span className="brand-mark">R</span>
          <span><strong>RiskRail</strong><small>Bitcoin risk intelligence</small></span>
        </a>
        <div className="landing-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#infrastructure">Infrastructure</a>
          <a href="https://github.com/TheSoftNode/riskrail" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Risk infrastructure for Bitcoin capital on Stacks</span>
          <h1>Know where your Bitcoin risk lives.</h1>
          <p>
            RiskRail turns fragmented wallet and protocol positions into one explainable risk view: collateral health, liquidation distance, concentration, stress scenarios and verifiable on-chain attestations.
          </p>
          <div className="hero-actions">
            <button type="button" className="button button-primary button-large" onClick={() => void connectWallet()}>
              {walletAddress ? 'Open connected wallet' : 'Connect Stacks wallet'}
            </button>
            <span>or inspect any public address</span>
          </div>
          {walletError ? <p className="error-box">{walletError}</p> : null}
        </div>

        <div className="hero-console">
          <div className="console-top"><span /><span /><span /></div>
          <div className="console-content">
            <div><small>PORTFOLIO RISK</small><strong>MODERATE</strong></div>
            <div className="console-metrics">
              <span><small>Health factor</small><strong>1.47</strong></span>
              <span><small>Liquidation distance</small><strong>18.0%</strong></span>
              <span><small>Protocol concentration</small><strong>44.0%</strong></span>
            </div>
            <div className="console-shock"><span>BTC -20%</span><strong>Health → 1.20</strong><em>threshold approaching</em></div>
            <div className="console-hash"><small>Report hash</small><code>3f8a9b…c6d120</code><span>✓ deterministic</span></div>
          </div>
        </div>
      </section>

      <form className="address-search" onSubmit={inspect}>
        <div><span className="eyebrow">Public address lookup</span><strong>Inspect without connecting a wallet</strong></div>
        <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter SP… or ST… address" />
        <button type="submit" className="button button-secondary">Analyze address</button>
      </form>

      <section className="landing-feature-grid" id="how-it-works">
        <Feature number="01" title="Discover positions">Native Stacks balances and supported protocol positions are normalized into one portfolio model.</Feature>
        <Feature number="02" title="Calculate risk">Deterministic formulas produce collateral, debt, concentration, liquidity and liquidation metrics.</Feature>
        <Feature number="03" title="Stress the portfolio">Run BTC, STX or custom market shocks against the latest indexed positions without moving funds.</Feature>
        <Feature number="04" title="Verify the report">Risk reports are hashed and can be anchored through RiskRail's Clarity registry for independent verification.</Feature>
      </section>

      <section className="infrastructure-section" id="infrastructure">
        <div>
          <span className="eyebrow">Designed as infrastructure</span>
          <h2>Not another trading venue.</h2>
          <p>RiskRail sits across wallets and financial protocols. Adapters understand each protocol; the portfolio and risk engines stay protocol-neutral.</p>
        </div>
        <div className="rail-diagram" aria-label="RiskRail architecture">
          <span>Stacks</span><i>→</i><span>Adapters</span><i>→</i><span>Portfolio</span><i>→</i><span>Risk engine</span><i>→</i><span>API + Clarity</span>
        </div>
      </section>
    </main>
  );
}

function Feature({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <article className="landing-feature"><span>{number}</span><h3>{title}</h3><p>{children}</p></article>;
}

export default function Home() {
  return (
    <main className="shell">
      <header className="header">
        <div className="brand">RiskRail</div>
        <div className="badge">Stacks • sBTC • Risk Infrastructure</div>
      </header>
      <section className="hero">
        <h1>Know where your Bitcoin risk lives.</h1>
        <p>
          RiskRail is a non-custodial risk intelligence layer for Stacks. It normalizes protocol positions,
          calculates deterministic exposure and stress metrics, and anchors verifiable risk attestations on-chain.
        </p>
      </section>
      <section className="grid">
        <article className="card"><span className="label">Portfolio risk</span><strong>—</strong><p>Connect or enter a Stacks address after the indexer is configured.</p></article>
        <article className="card"><span className="label">Protocol concentration</span><strong>—</strong><p>Cross-protocol normalized exposure.</p></article>
        <article className="card"><span className="label">On-chain attestation</span><strong>Ready</strong><p>Clarity registry contracts are included in the scaffold.</p></article>
      </section>
    </main>
  );
}

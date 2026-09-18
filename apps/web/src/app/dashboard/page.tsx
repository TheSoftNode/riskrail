import { DashboardClient } from '../../components/dashboard-client';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  const params = await searchParams;
  const address = params.address?.trim() ?? '';

  if (!address) {
    return (
      <main className="shell narrow-shell">
        <a href="/" className="brand-lockup"><span className="brand-mark">R</span><span><strong>RiskRail</strong><small>Bitcoin risk intelligence</small></span></a>
        <section className="panel onboarding-panel standalone-panel">
          <span className="eyebrow">No address selected</span>
          <h1>Start with a Stacks address.</h1>
          <p>Return to the home page, connect a wallet or paste a public address to inspect.</p>
          <a className="button button-primary inline-button" href="/">Back to RiskRail</a>
        </section>
      </main>
    );
  }

  return <DashboardClient initialAddress={address} />;
}

"use client";

import { Reveal, SectionHeading } from "./primitives";

/**
 * The four stages are a pipeline, not a feature grid — so each one declares what
 * it emits. The type names are the real ones from `packages/adapter-core` and
 * `packages/risk-engine`, which is the point: a reviewer can go and read them.
 */
const STAGES = [
  {
    n: "01",
    code: "DISCOVER",
    title: "Discover positions",
    body: "A protocol adapter per venue reads native Stacks balances, lending obligations and stream state, then emits one normalized position shape. Nothing above the adapter learns which protocol it came from.",
    emits: "NormalizedPosition[]",
  },
  {
    n: "02",
    code: "SCORE",
    title: "Calculate risk",
    body: "Deterministic formulas — no model, no opinion — produce collateral value, debt, current LTV, health factor, liquidation distance and concentration. Same inputs, same numbers, every time.",
    emits: "PortfolioRiskSummary",
  },
  {
    n: "03",
    code: "STRESS",
    title: "Stress the portfolio",
    body: "Shock BTC or STX and the lending position is recalculated against the protocol's own thresholds, not just marked down on screen. Scenarios that cross into liquidation are flagged.",
    emits: "StressScenarioResult[]",
  },
  {
    n: "04",
    code: "ATTEST",
    title: "Verify the report",
    body: "The full report is canonicalized and hashed with SHA-256, and stored alongside its digest. That digest can then be anchored in RiskRail's Clarity registry, so anyone can re-hash the JSON and confirm nothing was edited after the fact.",
    emits: "risk-registry.clar",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border">
      <div className="rr-shell py-20 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Four steps, and every one of them is auditable."
            lede="RiskRail is built so a reviewer can follow a number from the chain all the way to the screen without trusting us in between."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card">
            {/* Transport rail across the top of the pipeline. */}
            <div aria-hidden className="border-b border-border">
              <svg
                viewBox="0 0 1200 12"
                className="h-3 w-full"
                fill="none"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="rr-stage" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <line
                  x1="0"
                  y1="6"
                  x2="1200"
                  y2="6"
                  stroke="var(--border)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="0"
                  y1="6"
                  x2="1200"
                  y2="6"
                  stroke="url(#rr-stage)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="rr-rail-pulse"
                  style={{ "--rr-dur": "6s" } as React.CSSProperties}
                />
              </svg>
            </div>

            <div className="grid divide-y divide-border lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {STAGES.map((s) => (
                <article key={s.n} className="flex flex-col p-6">
                  <header className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                    <span className="text-muted-foreground">{s.n}</span>
                    <span className="text-border">/</span>
                    <span className="text-foreground">{s.code}</span>
                    <span className="ml-auto size-1.5 rounded-full bg-brand/60" />
                  </header>

                  <h3 className="mt-4 text-[0.9375rem] font-semibold tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-2 flex-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>

                  <footer className="mt-5 border-t border-border/60 pt-3">
                    <p className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Emits
                    </p>
                    <code className="mt-1.5 block truncate font-mono text-[0.6875rem] text-brand-text">
                      {s.emits}
                    </code>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

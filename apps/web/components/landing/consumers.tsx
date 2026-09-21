"use client";

import { Reveal, SectionHeading } from "./primitives";

/**
 * The consumer half of the story.
 *
 * Every other section on this page is written from the perspective of someone
 * inspecting their own portfolio. This one is about products that call Rivisk
 * so they do not have to build risk themselves — which is the actual thesis.
 *
 * Categories, deliberately, not company names. Real Stacks products fitting
 * each of these are named in the grant application, where the audience can
 * check them; putting other teams' names on our marketing site would read as
 * endorsement they never agreed to give.
 */

const PATHS = [
  {
    code: "OFF-CHAIN",
    label: "REST and typed SDK",
    call: "GET /api/v1/portfolios/{address}/risk",
    body: "The full picture: normalized positions, collateral health, liquidation distance, concentration, stress scenarios, alerts and signed webhooks.",
  },
  {
    code: "ON-CHAIN",
    label: "Clarity trait",
    call: "(contract-call? .risk-registry get-risk-if-fresh user u144)",
    body: "The compact attested subset another contract can act on, with a SHA-256 digest of the full report and a freshness bound that cannot be skipped.",
  },
];

const CATEGORIES = [
  {
    n: "01",
    code: "YIELD ROUTERS",
    question: "Is this wallet safe to route into another position?",
    reads: ["Risk score", "Concentration", "Stress results"],
    path: "REST / SDK",
  },
  {
    n: "02",
    code: "AUTONOMOUS AGENTS",
    question: "Should I take this action, or has the portfolio moved against me?",
    reads: ["Health factor", "Liquidation distance", "Freshness bound"],
    path: "Clarity trait",
  },
  {
    n: "03",
    code: "LENDING PRODUCTS",
    question: "What does this borrower look like outside my own protocol?",
    reads: ["Cross-protocol debt", "Collateral health", "LTV bands"],
    path: "Clarity trait / REST",
  },
  {
    n: "04",
    code: "TREASURIES AND WALLETS",
    question: "What is our total exposure, and what breaks first?",
    reads: ["Portfolio value", "Concentration", "Alerts and policy"],
    path: "SDK / webhooks",
  },
];

export function Consumers() {
  return (
    <section id="consumers" className="border-t border-border">
      <div className="rr-shell py-20 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Built to be consumed"
            title="Risk is a dependency, not a feature every product rebuilds."
            lede="A yield router should not have to index Stacks, read Zest debt, derive health factors and run stress scenarios in order to tell a user whether a position is safe. It should be able to ask — and get an answer that covers every protocol the wallet touches, not just its own."
          />
        </Reveal>

        {/* Two integration paths. */}
        <div className="mt-12 grid gap-4 [&>*]:min-w-0 md:grid-cols-2">
          {PATHS.map((p, i) => (
            <Reveal key={p.code} delay={i * 0.08}>
              <article className="h-full overflow-hidden rounded-xl border border-border bg-card">
                <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                  <span className="text-brand-text">{p.code}</span>
                  <span className="text-border">/</span>
                  <span className="text-muted-foreground">{p.label}</span>
                </header>
                <div className="px-4 py-4">
                  <code className="block overflow-x-auto whitespace-pre font-mono text-[0.75rem] leading-relaxed text-foreground">
                    {p.call}
                  </code>
                  <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* What each kind of product is actually asking. */}
        <div className="mt-4 grid gap-4 [&>*]:min-w-0 sm:grid-cols-2">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.code} delay={0.16 + i * 0.06}>
              <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                <header className="flex items-center gap-2 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                  <span className="text-muted-foreground">{c.n}</span>
                  <span className="text-border">/</span>
                  <span className="text-foreground">{c.code}</span>
                </header>

                <div className="flex flex-1 flex-col px-4 py-4">
                  <p className="text-[0.9375rem] font-medium leading-relaxed tracking-tight">
                    &ldquo;{c.question}&rdquo;
                  </p>

                  <dl className="mt-4 flex flex-1 flex-col justify-end gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <dt className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
                        Reads
                      </dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {c.reads.map((r) => (
                          <span
                            key={r}
                            className="rounded border border-border/70 bg-elevated/50 px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground"
                          >
                            {r}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
                        Via
                      </dt>
                      <dd className="font-mono text-[0.6875rem] text-brand-text">
                        {c.path}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Saying plainly what has and has not happened yet. */}
        <Reveal delay={0.4}>
          <p className="mt-6 max-w-3xl text-[0.8125rem] leading-relaxed text-muted-foreground">
            These are the integration shapes Rivisk is built for. The API, SDK,
            signed webhooks and the Clarity trait are implemented and tested; no
            third-party product is consuming them yet, and nothing here should be
            read as a partnership.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

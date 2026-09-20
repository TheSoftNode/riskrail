"use client";

import { IllustrativeTag, Reveal, SectionHeading } from "./primitives";

/* Each source is honest about its own slice and blind to the other two. */
const SOURCES = [
  {
    id: "01",
    code: "ZEST-V2",
    rows: [
      ["Collateral", "$14,200"],
      ["Borrowed", "$6,000"],
      ["Health factor", "1.54"],
    ],
    sees: 0,
  },
  {
    id: "02",
    code: "BITPAY",
    rows: [
      ["sBTC locked", "0.035"],
      ["Withdrawable", "0.009"],
      ["Unvested", "0.016"],
    ],
    sees: 1,
  },
  {
    id: "03",
    code: "WALLET",
    rows: [
      ["sBTC", "0.080"],
      ["STX", "4,120"],
      ["USDC", "2,400"],
    ],
    sees: 2,
  },
];

const SCOPE = ["ZST", "BTP", "WAL"];

const TOTALS = [
  { label: "Total sBTC exposure", value: "0.184", unit: "sBTC" },
  { label: "Immediately liquid", value: "59", unit: "%" },
  { label: "Locked / vesting", value: "17", unit: "%" },
  { label: "Collateralized", value: "24", unit: "%" },
];

/* Merge harness — x positions match the three column centres. */
const HARNESS = [
  { d: "M 200 0 L 200 26 C 200 74 600 56 600 104", delay: "0s", dur: "3.6s" },
  { d: "M 600 0 L 600 104", delay: "1.2s", dur: "3.1s" },
  { d: "M 1000 0 L 1000 26 C 1000 74 600 56 600 104", delay: "2.3s", dur: "3.9s" },
];

export function Fragmentation() {
  return (
    <section className="relative border-t border-border bg-card/40">
      <div className="rr-shell py-20 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="The problem"
            title="Three protocols. Three answers. No portfolio."
            lede="Each source is honest about its own position and blind to every other one. Nothing in the stack tells a holder or a treasury what their total Bitcoin exposure actually is, or what breaks first when the market moves."
          />
        </Reveal>

        {/* ── isolated sources ─────────────────────────────────────── */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {SOURCES.map((src, i) => (
            <Reveal key={src.code} delay={i * 0.08}>
              <article className="h-full overflow-hidden rounded-xl border border-border bg-background">
                <header className="flex items-center gap-2 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                  <span className="text-muted-foreground">SRC {src.id}</span>
                  <span className="text-border">/</span>
                  <span className="text-foreground">{src.code}</span>
                </header>

                <dl className="px-4 py-1">
                  {src.rows.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2.5 last:border-0"
                    >
                      <dt className="font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="rr-tnum text-[0.875rem] font-semibold">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* Coverage matrix: only its own cell is lit. */}
                <footer className="flex items-center gap-2.5 border-t border-border bg-muted/30 px-4 py-2.5">
                  <span className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
                    Field of view
                  </span>
                  <span className="ml-auto flex gap-1">
                    {SCOPE.map((cell, idx) => {
                      const lit = idx === src.sees;
                      return (
                        <span
                          key={cell}
                          className={[
                            "rounded px-1.5 py-0.5 font-mono text-[0.5625rem] tracking-wider",
                            lit
                              ? "bg-brand/15 text-brand-text"
                              : "text-muted-foreground/40 line-through",
                          ].join(" ")}
                        >
                          {cell}
                        </span>
                      );
                    })}
                  </span>
                </footer>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Decode the coverage matrix rather than making the reader infer it. */}
        <Reveal delay={0.2}>
          <p className="mt-4 max-w-3xl text-[0.8125rem] leading-relaxed text-muted-foreground">
            The three codes in each footer are the data sources. Only the lit one
            is visible to that protocol; the struck-through codes are the
            positions it cannot see &mdash; which is why no single row adds up to a
            portfolio.
          </p>
        </Reveal>

        {/* Three is today's adapter coverage, not a limit of the design. A
            reader should not leave thinking RiskRail only ever reads three
            venues. */}
        <Reveal delay={0.22}>
          <p className="mt-3 max-w-3xl text-[0.8125rem] leading-relaxed text-muted-foreground">
            Three is what RiskRail reads today, not what it is limited to. Each
            source is an adapter behind one interface, so the next venue changes
            nothing above it &mdash; not the portfolio engine, the risk engine, the
            API or this page.
          </p>
        </Reveal>

        {/* ── merge harness ────────────────────────────────────────── */}
        <Reveal delay={0.22}>
          <div aria-hidden className="relative">
            <svg
              viewBox="0 0 1200 112"
              className="h-16 w-full sm:h-20"
              fill="none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="rr-merge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="1" />
                </linearGradient>
              </defs>

              {HARNESS.map((h, i) => (
                <path
                  key={`rail-${i}`}
                  d={h.d}
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {HARNESS.map((h, i) => (
                <path
                  key={`pulse-${i}`}
                  d={h.d}
                  stroke="url(#rr-merge)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="rr-drop"
                  style={
                    {
                      "--rr-delay": h.delay,
                      "--rr-dur": h.dur,
                    } as React.CSSProperties
                  }
                />
              ))}
            </svg>
          </div>
        </Reveal>

        {/* ── normalized output ───────────────────────────────────── */}
        <Reveal delay={0.3}>
          <div className="overflow-hidden rounded-xl border border-brand/25 bg-card">
            <header className="flex flex-wrap items-center gap-2.5 border-b border-brand/20 bg-brand/[0.06] px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-brand opacity-60 rr-breathe" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
              </span>
              <span className="text-brand-text">Normalized</span>
              <span className="text-brand-text/40">/</span>
              <span className="text-muted-foreground">
                3 sources · 1 portfolio
              </span>
              <IllustrativeTag className="ml-auto" />
            </header>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              {TOTALS.map((t) => (
                <div
                  key={t.label}
                  className="border-b border-border px-5 py-6 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0"
                >
                  <p className="font-mono text-[0.5625rem] tracking-[0.1em] text-muted-foreground">
                    {t.label}
                  </p>
                  <p className={`mt-3 flex items-baseline ${t.unit === "%" ? "gap-0" : "gap-1.5"}`}>
                    <span className="rr-tnum text-[1.75rem] font-semibold leading-none tracking-tight">
                      {t.value}
                    </span>
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">
                      {t.unit}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

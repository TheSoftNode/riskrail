"use client";

import { TriangleAlert } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IllustrativeTag, Reveal, SectionHeading } from "./primitives";

/** Worked example: one sBTC-collateralized lending position under BTC drawdown. */
const CURVE = [
  { shock: "0%", health: 1.47 },
  { shock: "−5%", health: 1.4 },
  { shock: "−10%", health: 1.34 },
  { shock: "−15%", health: 1.27 },
  { shock: "−20%", health: 1.2 },
  { shock: "−25%", health: 1.13 },
  { shock: "−30%", health: 1.07 },
  { shock: "−35%", health: 0.98 },
];

/** Share of gross exposure by protocol — magnitude of one measure, so one hue. */
const EXPOSURE = [
  { name: "Zest lending", pct: 44, shade: "oklch(0.7971 0.1339 211.53)" },
  { name: "Wallet", pct: 31, shade: "oklch(0.7148 0.1257 215.22)" },
  { name: "BitPay streams", pct: 17, shade: "oklch(0.6089 0.1109 221.72)" },
  { name: "Other", pct: 8, shade: "oklch(0.5198 0.0936 223.13)" },
];

/** The point that crosses the threshold is marked in red, not left to color alone. */
function HealthDot(props: {
  cx?: number;
  cy?: number;
  payload?: { health: number };
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const breached = (payload?.health ?? 2) <= 1;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={breached ? 5 : 3.5}
      fill={breached ? "var(--high)" : "var(--chart-1)"}
      stroke="var(--card)"
      strokeWidth={2}
    />
  );
}

function HealthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  const breached = value <= 1;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="text-[0.6875rem] text-muted-foreground">BTC {label}</p>
      <p
        className={`rr-tnum text-sm font-semibold ${breached ? "text-high" : "text-foreground"}`}
      >
        Health factor {value.toFixed(2)}
      </p>
      {breached ? (
        <p className="mt-0.5 text-[0.6875rem] text-high">Below liquidation threshold</p>
      ) : null}
    </div>
  );
}

export function StressShowcase() {
  return (
    <section id="stress" className="border-t border-border bg-card/40">
      <div className="rr-shell py-20 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Stress testing"
            title="See how close a position is to breaking, before it does."
            lede="Shocks are applied to the latest indexed positions and re-scored against each protocol's own liquidation thresholds. RiskRail marks positions with its own price source, so these are modeled estimates rather than a protocol's execution-time verdict. Nothing is executed and no funds move."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.45fr_1fr]">
          {/* Stress curve */}
          <Reveal>
            <figure className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
              <figcaption className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full rounded-full bg-brand opacity-60 rr-breathe" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
                <span className="text-foreground">Stress curve</span>
                <span className="text-border">/</span>
                <span className="text-muted-foreground">sBTC collateral</span>
              </figcaption>

              <div className="flex flex-1 flex-col p-5">
              <h3 className="text-[0.9375rem] font-semibold tracking-tight">
                Health factor under BTC drawdown
              </h3>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                Modeled partial-liquidation threshold at 1.00
              </p>

              <div className="mt-5 h-[16.25rem] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={CURVE}
                    margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="rr-health" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    {/* Liquidation zone */}
                    <ReferenceArea
                      y1={0.9}
                      y2={1}
                      fill="var(--high)"
                      fillOpacity={0.14}
                      ifOverflow="hidden"
                    />

                    <CartesianGrid
                      stroke="var(--border)"
                      strokeOpacity={0.5}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="shock"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      dy={6}
                    />
                    <YAxis
                      domain={[0.9, 1.55]}
                      ticks={[1.0, 1.15, 1.3, 1.45]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      width={52}
                    />
                    <Tooltip
                      content={<HealthTooltip />}
                      cursor={{
                        stroke: "var(--muted-foreground)",
                        strokeDasharray: "3 3",
                        strokeOpacity: 0.6,
                      }}
                    />
                    <ReferenceLine
                      y={1}
                      stroke="var(--high)"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      label={{
                        value: "Liquidation 1.00",
                        position: "insideTopLeft",
                        fill: "var(--high)",
                        fontSize: 11,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="health"
                      baseValue={0.9}
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#rr-health)"
                      isAnimationActive={false}
                      dot={<HealthDot />}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: "var(--card)",
                        fill: "var(--chart-1)",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.07] px-3 py-2 text-[0.75rem] leading-relaxed text-foreground">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
                A 35% BTC drawdown is estimated to take this position to
                0.98 — across its modeled partial-liquidation threshold.
                RiskRail raises that as a breach rather than leaving it in a
                table.
              </p>
              </div>

              <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
                <span>Basis</span>
                <span className="text-border">/</span>
                <span className="rr-tnum">block 184,233</span>
                <span className="text-border">·</span>
                <span className="rr-tnum">coverage 98.4%</span>
                <span className="ml-auto">riskrail-v1.2</span>
              </footer>
            </figure>
          </Reveal>

          {/* Exposure — sequential, one hue, direct-labeled */}
          <Reveal delay={0.1}>
            <figure className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
              <figcaption className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full rounded-full bg-brand opacity-60 rr-breathe" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
                <span className="text-foreground">Exposure</span>
                <IllustrativeTag className="ml-auto" />
              </figcaption>

              <div className="flex flex-1 flex-col p-5">
              <h3 className="text-[0.9375rem] font-semibold tracking-tight">
                Where the capital sits
              </h3>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                Share of gross exposure by protocol
              </p>

              <ul className="mt-6 space-y-5">
                {EXPOSURE.map((row) => (
                  <li key={row.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[0.8125rem] text-foreground">
                        {row.name}
                      </span>
                      <span className="rr-tnum text-[0.8125rem] font-semibold">
                        {row.pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.pct}%`,
                          backgroundColor: row.shade,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-6 flex-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                Concentration is scored on gross exposure, so a leveraged
                position cannot hide behind a small net number.
              </p>
              </div>

              <footer className="flex items-center gap-x-3 border-t border-border px-4 py-2.5 font-mono text-[0.5625rem] tracking-[0.12em] text-muted-foreground">
                <span className="uppercase">Metric</span>
                <span className="text-border">/</span>
                {/* A real API field name — uppercasing it would make it wrong. */}
                <span>protocolConcentrationBps</span>
              </footer>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

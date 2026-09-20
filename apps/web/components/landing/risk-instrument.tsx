"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { IllustrativeTag } from "./primitives";

/* ---------------------------------------------------------------- data */

const HORIZON = [
  { drop: 0, health: 1.47 },
  { drop: -5, health: 1.4 },
  { drop: -10, health: 1.34 },
  { drop: -15, health: 1.27 },
  { drop: -20, health: 1.2 },
  { drop: -25, health: 1.13 },
  { drop: -30, health: 1.07 },
  { drop: -35, health: 0.98 },
  { drop: -40, health: 0.91 },
];

const RISK_SCORE = 44.8;
const START_BLOCK = 184_233;

/* ------------------------------------------------------- chart geometry */

const CW = 300;
const CH = 96;
const Y_MIN = 0.88;
const Y_MAX = 1.5;

const px = (i: number) => (i / (HORIZON.length - 1)) * CW;
const py = (h: number) => CH - ((h - Y_MIN) / (Y_MAX - Y_MIN)) * CH;

const LINE = HORIZON.map((d, i) => `${px(i).toFixed(1)},${py(d.health).toFixed(1)}`).join(" ");
const AREA = `0,${CH} ${LINE} ${CW},${CH}`;
const THRESHOLD_Y = py(1);

/* ---------------------------------------------------------- gauge maths */

const R = 46;
const C = 2 * Math.PI * R;
const ARC = Number((C * 0.75).toFixed(3)); // 270° dial, gap at the bottom

/* --------------------------------------------------------------- helpers */

const HEX = "0123456789abcdef";
const FINAL_HASH = "3f8a9b21c47e05d8aa1b6f2093c4d7e5c6d120";
const SHOWN = 18;

function toneFor(health: number) {
  if (health <= 1) return "text-high";
  if (health <= 1.25) return "text-warning";
  return "text-healthy";
}

/* ------------------------------------------------------------ component */

export function RiskInstrument() {
  const reduce = useReducedMotion();
  const [cursor, setCursor] = useState(4); // BTC −20% reads as the headline case
  const [block, setBlock] = useState(START_BLOCK);
  const [hash, setHash] = useState(FINAL_HASH.slice(0, SHOWN));
  const settling = useRef(false);

  // Playhead walks the drawdown ladder.
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(
      () => setCursor((c) => (c + 1) % HORIZON.length),
      1_400,
    );
    return () => window.clearInterval(id);
  }, [reduce]);

  // Chain tip advances the way a block feed would.
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setBlock((b) => b + 1), 9_000);
    return () => window.clearInterval(id);
  }, [reduce]);

  // Re-derive the digest periodically: scramble, then lock left to right.
  useEffect(() => {
    if (reduce) return;
    const target = FINAL_HASH.slice(0, SHOWN);

    const run = () => {
      if (settling.current) return;
      settling.current = true;
      let frame = 0;
      const id = window.setInterval(() => {
        frame += 1;
        const locked = Math.min(SHOWN, Math.floor(frame / 1.4));
        setHash(
          target.slice(0, locked) +
            Array.from(
              { length: SHOWN - locked },
              () => HEX[Math.floor(Math.random() * 16)],
            ).join(""),
        );
        if (locked >= SHOWN) {
          window.clearInterval(id);
          settling.current = false;
        }
      }, 45);
    };

    const loop = window.setInterval(run, 7_000);
    return () => window.clearInterval(loop);
  }, [reduce]);

  const active = HORIZON[cursor]!;
  const pct = RISK_SCORE / 100;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/30">
        {/* ── status rail ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-healthy opacity-60 rr-breathe" />
            <span className="relative inline-flex size-1.5 rounded-full bg-healthy" />
          </span>
          <span className="text-healthy">Indexed</span>
          <span className="text-border">/</span>
          <span>SP2ABC…92DF</span>
          <span className="ml-auto rr-tnum">#{block.toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 p-5">
          {/* ── dial ────────────────────────────────────────────────── */}
          <div className="relative grid place-items-center">
            <svg width="132" height="132" viewBox="0 0 132 132" fill="none">
              {/* tick ring */}
              {Array.from({ length: 28 }).map((_, i) => {
                const a = (135 + (i / 27) * 270) * (Math.PI / 180);
                const r1 = 56;
                const r2 = i % 9 === 0 ? 50 : 53;
                // Math.cos/sin are not spec-required to be correctly rounded, so
                // Node and the browser can differ in the last ULP and React
                // flags a hydration mismatch. Fixed precision makes them agree.
                const at = (r: number, fn: (n: number) => number) =>
                  Number((66 + fn(a) * r).toFixed(3));
                return (
                  <line
                    key={i}
                    x1={at(r1, Math.cos)}
                    y1={at(r1, Math.sin)}
                    x2={at(r2, Math.cos)}
                    y2={at(r2, Math.sin)}
                    stroke="var(--border)"
                    strokeWidth={i % 9 === 0 ? 1.2 : 0.8}
                  />
                );
              })}

              <g transform="rotate(135 66 66)">
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  stroke="var(--border)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${ARC} ${C}`}
                />
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  stroke="var(--brand)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${ARC * pct} ${C}`}
                  className="rr-draw"
                  style={
                    {
                      "--rr-len": `${ARC * pct}`,
                      "--rr-to": "0",
                      "--rr-delay": "0.35s",
                    } as React.CSSProperties
                  }
                />
              </g>
            </svg>

            <div className="absolute grid place-items-center text-center">
              <span className="rr-tnum text-[1.75rem] font-semibold leading-none tracking-tight">
                {RISK_SCORE.toFixed(1)}
              </span>
              <span className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground">
                Risk / 100
              </span>
            </div>
          </div>

          {/* ── readouts ───────────────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-3">
            <Readout label="Net value" value="$31,842" />
            <Readout label="Health factor" value="1.47" tone="text-healthy" />
            <Readout label="Liquidation distance" value="18.0%" />
            <Readout label="Protocol concentration" value="44.0%" />
          </div>
        </div>

        {/* ── liquidation horizon ─────────────────────────────────── */}
        <div className="border-t border-border px-5 pt-4 pb-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              Liquidation horizon
            </span>
            <span className="rr-tnum font-mono text-[0.6875rem] text-muted-foreground">
              BTC {active.drop === 0 ? "0%" : `${active.drop}%`}
              <span className={`ml-2 font-semibold ${toneFor(active.health)}`}>
                {active.health.toFixed(2)}
              </span>
            </span>
          </div>

          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            className="mt-3 h-[6rem] w-full overflow-visible"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="rr-horizon" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* danger band below the threshold */}
            <rect
              x="0"
              y={THRESHOLD_Y}
              width={CW}
              height={CH - THRESHOLD_Y}
              fill="var(--high)"
              fillOpacity="0.1"
            />
            <line
              x1="0"
              y1={THRESHOLD_Y}
              x2={CW}
              y2={THRESHOLD_Y}
              stroke="var(--high)"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />

            <polygon points={AREA} fill="url(#rr-horizon)" />
            <polyline
              points={LINE}
              stroke="var(--brand)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="rr-draw"
              style={
                {
                  "--rr-len": "520",
                  "--rr-to": "0",
                  "--rr-delay": "0.5s",
                } as React.CSSProperties
              }
            />

            {/* playhead */}
            <line
              x1={px(cursor)}
              y1="0"
              x2={px(cursor)}
              y2={CH}
              stroke="var(--muted-foreground)"
              strokeOpacity="0.5"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              style={{ transition: reduce ? undefined : "all .4s cubic-bezier(.22,1,.36,1)" }}
            />
            <circle
              cx={px(cursor)}
              cy={py(active.health)}
              r="4"
              fill={active.health <= 1 ? "var(--high)" : "var(--brand)"}
              stroke="var(--card)"
              strokeWidth="2"
              style={{ transition: reduce ? undefined : "all .4s cubic-bezier(.22,1,.36,1)" }}
            />
          </svg>

          <div className="mt-1 flex justify-between font-mono text-[0.5625rem] text-muted-foreground">
            {HORIZON.map((d, i) => (
              <span
                key={d.drop}
                className={i === cursor ? "text-brand-text" : undefined}
              >
                {d.drop === 0 ? "0" : d.drop}
              </span>
            ))}
          </div>

          {/* Plain-language anchor: the dial and the threshold mean nothing to a
              reader who does not already know what a health factor is. */}
          <p className="mt-3 text-[0.75rem] leading-relaxed text-muted-foreground">
            Health factor compares the position against the protocol&apos;s
            partial-liquidation threshold. Above{" "}
            <span className="text-foreground">1.00</span> it sits clear of that
            threshold; at or below, it has crossed it and may become eligible
            for liquidation under the protocol&apos;s own rules.
          </p>
        </div>

        {/* ── attestation ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-t border-border bg-brand/[0.04] px-4 py-3">
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground">
            SHA-256
          </span>
          <span className="rr-tnum truncate font-mono text-[0.6875rem] text-brand-text">
            {hash}…
          </span>
          <span className="ml-auto shrink-0 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
            riskrail-v1.2
          </span>
        </div>
      </div>

      <IllustrativeTag className="absolute -bottom-3 right-4 border-border bg-card" />
    </motion.div>
  );
}

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className={`rr-tnum text-[0.9375rem] font-semibold ${tone ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

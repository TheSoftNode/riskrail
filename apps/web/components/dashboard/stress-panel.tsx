"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { riviskApi } from "@/lib/api";
import { formatBps, formatHealth } from "@/lib/format";
import { RISK_TONE } from "@/lib/risk";
import type { SimulationResponse, StressScenario } from "@/lib/types";

const ASSETS = ["sBTC", "BTC", "STX", "USDC"];

export function StressPanel({ address }: { address: string }) {
  const presets = useQuery({
    queryKey: ["stress-presets"],
    queryFn: () => riviskApi.presets(),
  });
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [asset, setAsset] = useState("sBTC");
  const [percent, setPercent] = useState("-20");

  const simulation = useMutation({
    mutationFn: (scenario: StressScenario) =>
      riviskApi.simulate(address, scenario.name, scenario.shocks),
    onSuccess: setResult,
  });

  const custom = useMemo<StressScenario>(
    () => ({
      name: `Custom ${asset} ${Number(percent) >= 0 ? "+" : ""}${percent}%`,
      shocks: [
        { symbol: asset, changeBps: Math.round(Number(percent || 0) * 100) },
      ],
    }),
    [asset, percent],
  );

  return (
    <Card id="stress" className="scroll-mt-24">
      <CardContent className="p-6">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          What-if analysis
        </p>
        <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
          Stress test the portfolio
        </h2>

        <p className="mt-3 max-w-3xl text-[0.875rem] leading-relaxed text-muted-foreground">
          Shocks are applied to a copy of the latest indexed positions and
          re-scored against each protocol&apos;s own thresholds. These are
          deterministic scenarios, not forecasts.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(presets.data ?? []).map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              disabled={simulation.isPending}
              onClick={() => simulation.mutate(preset)}
            >
              {preset.name}
            </Button>
          ))}
          {presets.isLoading ? (
            <span className="text-[0.8125rem] text-muted-foreground">
              Loading scenarios…
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-elevated/50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="stress-asset" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Asset
            </Label>
            <select
              id="stress-asset"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {ASSETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stress-pct" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Price change (%)
            </Label>
            <Input
              id="stress-pct"
              type="number"
              min="-100"
              max="1000"
              step="1"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            disabled={simulation.isPending || !Number.isFinite(Number(percent))}
            onClick={() => simulation.mutate(custom)}
            className="h-9 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
          >
            {simulation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Run scenario
          </Button>
        </div>

        {simulation.error ? (
          <p className="mt-4 rounded-lg border border-high/30 bg-high/10 px-3 py-2 text-[0.8125rem] text-high">
            {simulation.error.message}
          </p>
        ) : null}

        {result ? (
          <StressResult result={result} />
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
            Choose a scenario to compare current risk with stressed risk.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StressResult({ result }: { result: SimulationResponse }) {
  const tone = RISK_TONE[result.after.riskLevel];

  const beforeHf = result.before.worstHealthFactorE4;
  const afterHf = result.after.worstHealthFactorE4;
  const hasHealth = beforeHf !== undefined && afterHf !== undefined;

  const chartData = hasHealth
    ? [
        { name: "Now", value: beforeHf / 10_000, breached: beforeHf <= 10_000 },
        {
          name: result.scenario.name,
          value: afterHf / 10_000,
          breached: afterHf <= 10_000,
        },
      ]
    : [];

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            Scenario result
          </p>
          <p className="mt-1 font-medium">{result.scenario.name}</p>
        </div>
        <Badge variant="outline" className={`h-6 px-2.5 ${tone.badge}`}>
          <span className={`mr-1.5 size-1.5 rounded-full ${tone.dot}`} />
          {tone.label}
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Comparison
            label="Health factor"
            before={formatHealth(beforeHf)}
            after={formatHealth(afterHf)}
          />
          <Comparison
            label="Liquidation distance"
            before={formatBps(result.before.liquidationDistanceBps)}
            after={formatBps(result.after.liquidationDistanceBps)}
          />
          <Comparison
            label="Risk score"
            before={`${(result.before.riskScoreBps / 100).toFixed(1)}/100`}
            after={`${(result.after.riskScoreBps / 100).toFixed(1)}/100`}
          />
        </div>

        {hasHealth ? (
          <figure className="rounded-xl border border-border bg-elevated/40 p-4">
            <figcaption className="text-[0.75rem] text-muted-foreground">
              Worst health factor · liquidation at 1.00
            </figcaption>
            <div className="mt-3 h-[11.875rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 18, right: 8, bottom: 0, left: -18 }}
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    dy={4}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    width={46}
                  />
                  <ReferenceLine
                    y={1}
                    stroke="var(--high)"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={72}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill="var(--foreground)"
                      fontSize={12}
                      formatter={(v: unknown) =>
                        typeof v === "number" ? v.toFixed(2) : String(v ?? "")
                      }
                    />
                    {chartData.map((d) => (
                      <Cell
                        key={d.name}
                        fill={d.breached ? "var(--high)" : "var(--chart-1)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </figure>
        ) : null}
      </div>

      {result.warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          {result.warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 rounded-lg border border-high/30 bg-high/10 px-3 py-2 text-[0.8125rem] text-foreground"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-high" />
              {warning}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-healthy/30 bg-healthy/10 px-3 py-2 text-[0.8125rem] text-foreground">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-healthy" />
          No new critical threshold crossing was detected in this scenario.
        </p>
      )}
    </div>
  );
}

function Comparison({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated/40 p-4">
      <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 flex items-baseline gap-4">
        <span>
          <span className="block text-[0.625rem] text-muted-foreground">Now</span>
          <span className="rr-tnum text-lg font-semibold">{before}</span>
        </span>
        <span className="text-muted-foreground">→</span>
        <span>
          <span className="block text-[0.625rem] text-muted-foreground">After</span>
          <span className="rr-tnum text-lg font-semibold">{after}</span>
        </span>
      </div>
    </div>
  );
}

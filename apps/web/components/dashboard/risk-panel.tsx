"use client";

import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBps, formatHealth, shorten } from "@/lib/format";
import { RISK_COPY, RISK_TONE } from "@/lib/risk";
import type { RiskResponse } from "@/lib/types";

export function RiskPanel({
  risk,
  loading,
}: {
  risk?: RiskResponse;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-7 w-64" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // A snapshot that has not been computed yet is not the same as "unknown risk".
  const pending = risk?.status === "risk-pending";
  const level = risk?.riskLevel ?? "unknown";
  const tone = RISK_TONE[level];

  const metrics = [
    {
      label: "Risk score",
      value:
        risk?.riskScoreBps !== undefined
          ? `${(risk.riskScoreBps / 100).toFixed(1)}/100`
          : "—",
      hint: "Composite — individual metrics are authoritative",
    },
    {
      label: "Health factor",
      value: formatHealth(risk?.healthFactorE4),
      hint: "Lower means less buffer before liquidation",
    },
    {
      label: "Liquidation distance",
      value: formatBps(risk?.liquidationDistanceBps),
      hint: "Collateral drawdown the position absorbs",
    },
    {
      label: "Protocol concentration",
      value: formatBps(risk?.protocolConcentrationBps),
      hint: "Largest single-protocol share of gross exposure",
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Portfolio risk
            </p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight">
              Current risk picture
            </h2>
          </div>
          <Badge variant="outline" className={`h-6 px-2.5 ${tone.badge}`}>
            <span className={`mr-1.5 size-1.5 rounded-full ${tone.dot}`} />
            {pending ? "Computing" : tone.label}
          </Badge>
        </div>

        <p className="mt-3 max-w-3xl text-[0.875rem] leading-relaxed text-muted-foreground">
          {pending
            ? "The portfolio is indexed and the deterministic risk snapshot is still being computed. It normally lands a moment after indexing."
            : RISK_COPY[level]}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-elevated/50 p-4"
            >
              <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
                {m.label}
              </p>
              <p className="rr-tnum mt-2.5 text-xl font-semibold tracking-tight">
                {m.value}
              </p>
              <p className="mt-2 text-[0.6875rem] leading-snug text-muted-foreground">
                {m.hint}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-brand/20 bg-brand/[0.05] px-4 py-3">
          {risk?.reportHash ? (
            <ShieldCheck className="size-4 shrink-0 text-brand-text" />
          ) : (
            <ShieldQuestion className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              Report hash
            </p>
            <p className="truncate font-mono text-[0.75rem] text-brand-text">
              {risk?.reportHash ? shorten(risk.reportHash, 14, 10) : "Not published yet"}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
            <span>{risk?.methodologyVersion ?? "methodology pending"}</span>
            <span>
              {risk?.onchain?.txId
                ? "On-chain attestation broadcast"
                : "Off-chain report only"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

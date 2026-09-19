"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBps, formatUsd } from "@/lib/format";
import type { PortfolioResponse } from "@/lib/types";

export function OverviewCards({
  portfolio,
  loading,
}: {
  portfolio?: PortfolioResponse;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-4 h-7 w-24" />
              <Skeleton className="mt-4 h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const coverage = portfolio?.valuationCoverageBps ?? 0;
  const lowCoverage = coverage > 0 && coverage < 9_000;

  const cards = [
    {
      label: "Net portfolio value",
      value: formatUsd(portfolio?.totalValueUsd ?? "0"),
      hint: "Debt counted as negative equity",
      tone: "",
    },
    {
      label: "Valuation coverage",
      value: formatBps(coverage),
      hint: lowCoverage
        ? "Some assets have no price — metrics are partial"
        : "Share of gross exposure with a price",
      tone: lowCoverage ? "text-warning" : "",
    },
    {
      label: "Active positions",
      value: String(portfolio?.positions.length ?? 0),
      hint: "Across wallet and protocol adapters",
      tone: "",
    },
    {
      label: "Source block",
      value: portfolio?.sourceBlock ?? "—",
      hint: portfolio?.lastIndexedAt
        ? `Indexed ${new Date(portfolio.lastIndexedAt).toLocaleString()}`
        : "Not indexed yet",
      tone: "",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex h-full flex-col p-5">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {c.label}
            </p>
            <p
              className={`rr-tnum mt-3.5 truncate text-2xl font-semibold tracking-tight ${c.tone}`}
            >
              {c.value}
            </p>
            <p className="mt-auto pt-3 text-[0.75rem] leading-snug text-muted-foreground">
              {c.hint}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

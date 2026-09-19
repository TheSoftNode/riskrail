"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsd } from "@/lib/format";
import { rampColor } from "@/lib/risk";
import type { PortfolioResponse } from "@/lib/types";

function toRows(values?: Record<string, string>): Array<[string, number]> {
  if (!values) return [];
  return Object.entries(values)
    .map(([key, value]) => [key, Number(value)] as [string, number])
    .filter(([, v]) => Number.isFinite(v) && Math.abs(v) > 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

function Breakdown({
  rows,
  empty,
}: {
  rows: Array<[string, number]>;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
        {empty}
      </p>
    );
  }

  // Shares are of gross exposure, so a debt leg cannot cancel out a collateral leg.
  const total = rows.reduce((sum, [, v]) => sum + Math.abs(v), 0) || 1;

  return (
    <ul className="space-y-4">
      {rows.map(([key, value], i) => {
        const share = (Math.abs(value) / total) * 100;
        return (
          <li key={key}>
            <div className="flex items-baseline justify-between gap-3">
              {/* Labels come from the API already cased (sBTC, BitPay streams) —
                  a capitalize class would render them as "SBTC". */}
              <span className="truncate text-[0.8125rem]">{key}</span>
              <span className="rr-tnum shrink-0 text-[0.8125rem] font-medium">
                {formatUsd(value)}
                <span className="ml-2 text-muted-foreground">
                  {share.toFixed(1)}%
                </span>
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${share}%`, backgroundColor: rampColor(i) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ExposurePanel({
  portfolio,
  loading,
}: {
  portfolio?: PortfolioResponse;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24" />
              <div className="mt-6 space-y-5">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j}>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="mt-2 h-2 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardContent className="p-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Exposure
          </p>
          <h2 className="mt-1.5 mb-6 text-lg font-semibold tracking-tight">
            By protocol
          </h2>
          <Breakdown
            rows={toRows(portfolio?.byProtocol)}
            empty="No protocol exposure has been indexed yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Assets
          </p>
          <h2 className="mt-1.5 mb-6 text-lg font-semibold tracking-tight">
            By asset
          </h2>
          <Breakdown
            rows={toRows(portfolio?.byAsset)}
            empty="No priced assets have been indexed yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}

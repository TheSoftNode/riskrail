"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBps, formatHealth, formatUsd } from "@/lib/format";
import { roleTone } from "@/lib/risk";
import type { PortfolioPosition } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export function PositionsPanel({
  positions,
  loading,
}: {
  positions: PortfolioPosition[];
  loading?: boolean;
}) {
  return (
    <Card id="positions" className="scroll-mt-24">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Protocol positions
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
              Where capital is deployed
            </h2>
          </div>
          <Badge variant="outline" className="h-6 px-2.5">
            {positions.length}
          </Badge>
        </div>

        {loading ? (
          <div className="mt-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
            No active positions are indexed for this address yet.
          </p>
        ) : (
          <div className="mt-5 -mx-2 overflow-x-auto px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead className="text-right">Net value</TableHead>
                  <TableHead className="text-right">Health</TableHead>
                  <TableHead className="text-right">Liq. distance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => {
                  const liquidation = asRecord(position.details.liquidation);
                  const health = numberOrNull(liquidation.healthFactorE4);
                  return (
                    <TableRow key={position.id}>
                      <TableCell>
                        <span className="block font-medium">
                          {position.protocol.name}
                        </span>
                        <span className="block text-[0.6875rem] text-muted-foreground">
                          {position.protocol.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-brand-text">
                          {position.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {position.assets.slice(0, 4).map((asset, index) => (
                            <span
                              key={`${position.id}-${asset.assetId}-${asset.role}-${index}`}
                              className={`rounded-md border px-1.5 py-0.5 text-[0.625rem] ${roleTone(asset.role)}`}
                            >
                              {asset.symbol} · {asset.role}
                            </span>
                          ))}
                          {position.assets.length > 4 ? (
                            <span className="rounded-md border border-border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                              +{position.assets.length - 4}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="rr-tnum text-right">
                        {formatUsd(position.valueUsd)}
                      </TableCell>
                      <TableCell
                        className={`rr-tnum text-right ${
                          health !== null && health <= 12_000 ? "text-warning" : ""
                        }`}
                      >
                        {formatHealth(health)}
                      </TableCell>
                      <TableCell className="rr-tnum text-right">
                        {formatBps(numberOrNull(liquidation.distanceBps))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Loader2, RefreshCw, ScanLine, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The three pre-portfolio states. Previously a queued first index looked
 * identical to "never scanned" and a failed index rendered as a healthy $0.00
 * portfolio — both are called out explicitly here instead.
 */

export function NotIndexedCard({
  onIndex,
  pending,
}: {
  onIndex: () => void;
  pending: boolean;
}) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-7">
        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-brand/25 bg-brand/[0.08]">
          <ScanLine className="size-5 text-brand-text" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">
          This address has not been indexed yet.
        </h2>
        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">
          Rivisk will read the wallet, every enabled protocol adapter and the
          resulting risk state. It is a read-only scan — no transaction is
          signed and no funds are moved.
        </p>
        <Button
          size="lg"
          disabled={pending}
          onClick={onIndex}
          className="mt-7 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanLine className="size-4" />
          )}
          {pending ? "Starting scan…" : "Index this address"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function IndexingCard({ elapsedSeconds }: { elapsedSeconds: number }) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-7">
        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-brand/25 bg-brand/[0.08]">
          <Loader2 className="size-5 animate-spin text-brand-text" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">
          Reading on-chain state…
        </h2>
        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">
          Balances, protocol adapters and token metadata are being resolved,
          then prices are applied and the risk snapshot is computed. This
          usually takes a few seconds.
        </p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand" />
        </div>
        <p className="rr-tnum mt-2.5 text-[0.75rem] text-muted-foreground">
          {elapsedSeconds}s elapsed
        </p>
      </CardContent>
    </Card>
  );
}

export function IndexFailedCard({
  onRetry,
  pending,
  correlationId,
}: {
  onRetry: () => void;
  pending: boolean;
  correlationId?: string | null;
}) {
  return (
    <Card className="max-w-2xl border-high/30">
      <CardContent className="p-7">
        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-high/30 bg-high/10">
          <TriangleAlert className="size-5 text-high" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">
          The last index run failed.
        </h2>
        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">
          No portfolio was written, so there is nothing to score. This is
          usually an upstream Stacks API or price-source error rather than a
          problem with the address itself.
        </p>
        {correlationId ? (
          <p className="mt-4 rounded-lg border border-border bg-elevated px-3 py-2 font-mono text-[0.75rem]">
            <span className="text-muted-foreground">correlation </span>
            <span className="text-foreground">{correlationId}</span>
          </p>
        ) : null}
        <Button
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={onRetry}
          className="mt-7"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Retry index
        </Button>
      </CardContent>
    </Card>
  );
}

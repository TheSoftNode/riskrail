"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ExposurePanel } from "@/components/dashboard/exposure-panel";
import {
  IndexFailedCard,
  IndexingCard,
  NotIndexedCard,
} from "@/components/dashboard/index-status";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { PolicyPanel } from "@/components/dashboard/policy-panel";
import { PositionsPanel } from "@/components/dashboard/positions-panel";
import { RiskPanel } from "@/components/dashboard/risk-panel";
import { StressPanel } from "@/components/dashboard/stress-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/hooks/use-realtime";
import { riskrailApi } from "@/lib/api";
import { shorten } from "@/lib/format";
import {
  connectRiskRailWallet,
  disconnectRiskRailWallet,
  restoreRiskRailWallet,
} from "@/lib/wallet";
import type { RealtimeMessage } from "@/lib/types";

/** Stop polling rather than hammering the API forever if a job never lands. */
const INDEX_TIMEOUT_MS = 180_000;

export function DashboardClient({ initialAddress }: { initialAddress: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const address = initialAddress.trim();

  const [addressInput, setAddressInput] = useState(address);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [indexingSince, setIndexingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const onRealtime = useCallback((message: RealtimeMessage) => {
    if (message.event === "portfolio.updated") toast.success("Portfolio updated");
    if (message.event === "risk.updated") toast.success("Risk snapshot updated");
    if (message.event === "alert.triggered") toast.warning("Alert triggered");
    if (message.event === "policy.breached") toast.error("On-chain policy breached");
  }, []);

  const { connected } = useRealtime(address || null, onRealtime);

  useEffect(() => {
    void restoreRiskRailWallet().then(setConnectedAddress);
  }, []);

  const portfolio = useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => riskrailApi.portfolio(address),
    enabled: Boolean(address),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "processing" || status === "queued") return 2_000;
      // A queued first index writes no Wallet row until it finishes, so the
      // status stays "not-indexed" the whole time. Without this branch the
      // onboarding card never went away.
      if (indexingSince !== null) return 2_000;
      return false;
    },
  });

  const status = portfolio.data?.status;
  const hasSnapshot = Boolean(portfolio.data?.sourceBlock);

  // Settle the local indexing flag once the run reaches a terminal state.
  useEffect(() => {
    if (indexingSince === null) return;
    if (status === "failed" || ((status === "completed" || status === "indexed") && hasSnapshot)) {
      setIndexingSince(null);
      if (status === "failed") toast.error("Index run failed");
      else toast.success("Index complete");
    }
  }, [status, hasSnapshot, indexingSince]);

  // Elapsed counter + hard timeout.
  useEffect(() => {
    if (indexingSince === null) {
      setElapsed(0);
      return;
    }
    const tick = window.setInterval(() => {
      const ms = Date.now() - indexingSince;
      setElapsed(Math.floor(ms / 1000));
      if (ms > INDEX_TIMEOUT_MS) {
        setIndexingSince(null);
        toast.error("Indexing is taking longer than expected. Try again.");
      }
    }, 1_000);
    return () => window.clearInterval(tick);
  }, [indexingSince]);

  const risk = useQuery({
    queryKey: ["risk", address],
    queryFn: () => riskrailApi.risk(address),
    enabled: Boolean(address) && hasSnapshot,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "risk-pending" ? 3_000 : false,
  });

  const refresh = useMutation({
    mutationFn: () => riskrailApi.refresh(address),
    onSuccess: async () => {
      setIndexingSince(Date.now());
      await queryClient.invalidateQueries({ queryKey: ["portfolio", address] });
    },
    onError: (error) => toast.error(error.message),
  });

  async function connectWallet() {
    try {
      const wallet = await connectRiskRailWallet();
      setConnectedAddress(wallet);
      setAddressInput(wallet);
      router.push(`/dashboard?address=${encodeURIComponent(wallet)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wallet connection failed");
    }
  }

  function inspectAddress(event: FormEvent) {
    event.preventDefault();
    const next = addressInput.trim();
    if (next && next !== address) {
      router.push(`/dashboard?address=${encodeURIComponent(next)}`);
    }
  }

  const isIndexing = indexingSince !== null;
  const isFailed = status === "failed" && !hasSnapshot && !isIndexing;
  const isNotIndexed = status === "not-indexed" && !isIndexing;
  const showPortfolio = hasSnapshot;
  const firstLoad = portfolio.isLoading;

  const topbar = (
    <>
      <form onSubmit={inspectAddress} className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            placeholder="SP… or ST…"
            aria-label="Stacks address"
            className="h-9 pl-8 font-mono text-[0.75rem]"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Inspect
        </Button>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="hidden items-center gap-1.5 text-[0.6875rem] text-muted-foreground sm:flex"
          title={connected ? "Realtime connected" : "Realtime offline"}
        >
          <span
            className={`size-1.5 rounded-full ${connected ? "bg-healthy" : "bg-muted-foreground"}`}
          />
          {connected ? "Live" : "Offline"}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          disabled={refresh.isPending || isIndexing || !address}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending || isIndexing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        {connectedAddress ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 font-mono text-[0.75rem]"
            onClick={() => void disconnectRiskRailWallet().then(() => setConnectedAddress(null))}
          >
            {shorten(connectedAddress)}
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-9 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
            onClick={() => void connectWallet()}
          >
            <Wallet className="size-3.5" />
            <span className="hidden sm:inline">Connect</span>
          </Button>
        )}
      </div>
    </>
  );

  return (
    <DashboardShell topbar={topbar}>
      <section id="overview" className="scroll-mt-24">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Wallet intelligence
            </p>
            <h1 className="mt-1.5 truncate font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
              {shorten(address, 14, 8)}
            </h1>
          </div>
        </div>

        {portfolio.error ? (
          <p className="mb-4 rounded-lg border border-high/30 bg-high/10 px-4 py-3 text-[0.8125rem] text-high">
            Portfolio request failed: {portfolio.error.message}
          </p>
        ) : null}

        {isIndexing ? (
          <IndexingCard elapsedSeconds={elapsed} />
        ) : isFailed ? (
          <IndexFailedCard
            onRetry={() => refresh.mutate()}
            pending={refresh.isPending}
            correlationId={refresh.data?.correlationId}
          />
        ) : isNotIndexed ? (
          <NotIndexedCard
            onIndex={() => refresh.mutate()}
            pending={refresh.isPending}
          />
        ) : (
          <div className="space-y-3">
            <OverviewCards portfolio={portfolio.data} loading={firstLoad} />
            <RiskPanel
              risk={risk.data}
              loading={firstLoad || (showPortfolio && risk.isLoading)}
            />
            <ExposurePanel portfolio={portfolio.data} loading={firstLoad} />
          </div>
        )}
      </section>

      {showPortfolio && !isIndexing ? (
        <div className="mt-3 space-y-3">
          <PositionsPanel
            positions={portfolio.data?.positions ?? []}
            loading={firstLoad}
          />
          <StressPanel address={address} />
          <div className="grid gap-3 xl:grid-cols-2 xl:items-start">
            <AlertsPanel address={address} />
            <PolicyPanel address={address} />
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { DashboardContext, type DashboardState } from "@/components/dashboard/dashboard-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  IndexFailedCard,
  IndexingCard,
  NotIndexedCard,
} from "@/components/dashboard/index-status";
import { WalletEntry } from "@/components/wallet-entry";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/hooks/use-realtime";
import { riviskApi } from "@/lib/api";
import { sectionForPath } from "@/lib/dashboard-sections";
import { shorten } from "@/lib/format";
import {
  connectRiviskWallet,
  disconnectRiviskWallet,
  restoreRiviskWallet,
} from "@/lib/wallet";
import type { RealtimeMessage } from "@/lib/types";

/** Stop polling rather than hammering the API forever if a job never lands. */
const INDEX_TIMEOUT_MS = 180_000;

/** Wraps every /dashboard page. Reads `?address=` and owns the shared state. */
export function DashboardFrame({ children }: { children: ReactNode }) {
  const address = useSearchParams().get("address")?.trim() ?? "";
  if (!address) return <NoAddress />;
  // Keyed so a different wallet starts from clean indexing state.
  return (
    <WalletDashboard key={address} address={address}>
      {children}
    </WalletDashboard>
  );
}

function WalletDashboard({ address, children }: { address: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const section = sectionForPath(pathname);

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

  const { connected } = useRealtime(address, onRealtime);

  useEffect(() => {
    void restoreRiviskWallet().then(setConnectedAddress);
  }, []);

  const portfolio = useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => riviskApi.portfolio(address),
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
    queryFn: () => riviskApi.risk(address),
    enabled: hasSnapshot,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "risk-pending" ? 3_000 : false,
  });

  const refresh = useMutation({
    mutationFn: () => riviskApi.refresh(address),
    onSuccess: async () => {
      setIndexingSince(Date.now());
      await queryClient.invalidateQueries({ queryKey: ["portfolio", address] });
    },
    onError: (error) => toast.error(error.message),
  });

  // Changing wallet keeps you on the page you are on.
  const go = (next: string) => router.push(`${pathname}?address=${encodeURIComponent(next)}`);

  async function connectWallet() {
    try {
      const wallet = await connectRiviskWallet();
      setConnectedAddress(wallet);
      setAddressInput(wallet);
      go(wallet);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wallet connection failed");
    }
  }

  function inspectAddress(event: FormEvent) {
    event.preventDefault();
    const next = addressInput.trim();
    if (next && next !== address) go(next);
  }

  // Also covers a reload mid-index: the run is live server-side even though
  // this tab never started it.
  const isIndexing =
    indexingSince !== null || ((status === "processing" || status === "queued") && !hasSnapshot);
  const isFailed = status === "failed" && !hasSnapshot && !isIndexing;
  const isNotIndexed = status === "not-indexed" && !isIndexing;
  const firstLoad = portfolio.isLoading;

  const state = useMemo<DashboardState>(
    () => ({ address, portfolio, risk, firstLoad }),
    [address, portfolio, risk, firstLoad],
  );

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
          disabled={refresh.isPending || isIndexing}
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
            onClick={() => void disconnectRiviskWallet().then(() => setConnectedAddress(null))}
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
    <DashboardShell topbar={topbar} address={address}>
      <div className="mb-6 min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {section.label}
        </p>
        <h1 className="mt-1.5 truncate font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          {shorten(address, 14, 8)}
        </h1>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">{section.description}</p>
      </div>

      {portfolio.error ? (
        <p className="mb-4 rounded-lg border border-high/30 bg-high/10 px-4 py-3 text-[0.8125rem] text-high">
          Portfolio request failed: {portfolio.error.message}
        </p>
      ) : null}

      {/* Every page needs an indexed wallet, so the pre-portfolio states are
          handled once here instead of in each page. */}
      {isIndexing ? (
        <IndexingCard elapsedSeconds={elapsed} />
      ) : isFailed ? (
        <IndexFailedCard
          onRetry={() => refresh.mutate()}
          pending={refresh.isPending}
          correlationId={refresh.data?.correlationId}
        />
      ) : isNotIndexed ? (
        <NotIndexedCard onIndex={() => refresh.mutate()} pending={refresh.isPending} />
      ) : (
        <DashboardContext.Provider value={state}>{children}</DashboardContext.Provider>
      )}
    </DashboardShell>
  );
}

function NoAddress() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14 sm:px-8">
      <Link href="/" aria-label="Rivisk home">
        <Logo />
      </Link>
      <Card className="mt-14">
        <CardContent className="p-8">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            No address selected
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Start with a Stacks address.
          </h1>
          <p className="mt-3 mb-8 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Connect a wallet to load your own portfolio, or paste any public
            address to inspect it read-only.
          </p>
          {/* Offering the choice here rather than a link home: someone who
              arrives at this URL directly should be able to finish from it. */}
          <WalletEntry />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-[0.8125rem] text-muted-foreground">
        <Link href="/" className="underline underline-offset-4 hover:text-foreground">
          Back to Rivisk
        </Link>
      </p>
    </main>
  );
}

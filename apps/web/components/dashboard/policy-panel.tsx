"use client";

import { useQuery } from "@tanstack/react-query";
import { FileLock2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { riskrailApi } from "@/lib/api";
import { formatBps, formatHealth, shorten } from "@/lib/format";

export function PolicyPanel({ address }: { address: string }) {
  const policy = useQuery({
    queryKey: ["policy", address],
    queryFn: () => riskrailApi.policy(address),
  });

  const value = policy.data?.policy;
  const configured = policy.data?.configured;

  const status = !configured
    ? { label: "Contract not configured", tone: "border-border bg-muted text-muted-foreground" }
    : value?.enabled
      ? { label: "Enabled", tone: "border-healthy/30 bg-healthy/10 text-healthy" }
      : { label: "Not set", tone: "border-warning/30 bg-warning/10 text-warning" };

  return (
    <Card id="policy" className="scroll-mt-24">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              User-owned guardrails
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
              On-chain risk policy
            </h2>
          </div>
          <Badge variant="outline" className={`h-6 px-2.5 ${status.tone}`}>
            {status.label}
          </Badge>
        </div>

        <p className="mt-3 text-[0.875rem] leading-relaxed text-muted-foreground">
          Thresholds live in <code className="font-mono text-[0.8125rem] text-brand-text">risk-policy.clar</code>,
          owned by the wallet rather than by RiskRail. The worker reads them
          after every risk snapshot and records a breach independently of local
          alert rules.
        </p>

        {policy.isLoading ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !configured ? (
          <p className="mt-5 rounded-lg border border-dashed border-border px-4 py-6 text-[0.8125rem] leading-relaxed text-muted-foreground">
            The API has no{" "}
            <code className="font-mono">RISK_POLICY_CONTRACT</code> configured.
            Deploy the RiskRail policy contract and set that variable to start
            evaluating wallet-owned policies.
          </p>
        ) : value ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PolicyMetric
                label="Max risk score"
                value={`${(value.maxRiskScoreBps / 100).toFixed(1)}/100`}
              />
              <PolicyMetric
                label="Min health factor"
                value={formatHealth(value.minHealthFactorE4)}
              />
              <PolicyMetric
                label="Max protocol concentration"
                value={formatBps(value.maxProtocolConcentrationBps)}
              />
              <PolicyMetric
                label="Min liquidity score"
                value={formatBps(value.minLiquidityScoreBps)}
              />
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-muted-foreground">
              <FileLock2 className="size-3.5" />
              <span className="font-mono">
                {shorten(policy.data?.contract, 18, 12)}
              </span>
              <span>· updated at block {value.updatedAt}</span>
            </p>
          </>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-border px-4 py-6 text-[0.8125rem] leading-relaxed text-muted-foreground">
            No policy is stored on-chain for this wallet yet. RiskRail keeps
            using local alert rules until the wallet writes one. Writing a
            policy from the browser lands once the contracts are deployed to
            testnet and the transaction flow is verified.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-4">
      <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="rr-tnum mt-2.5 text-xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

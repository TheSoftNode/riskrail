"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileLock2, Loader2, PenLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { explorerTxUrl, writeRiskPolicy, type PolicyInput } from "@/lib/policy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { riviskApi } from "@/lib/api";
import { formatBps, formatHealth, shorten } from "@/lib/format";

export function PolicyPanel({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const policy = useQuery({
    queryKey: ["policy", address],
    queryFn: () => riviskApi.policy(address),
  });

  const [editing, setEditing] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [draft, setDraft] = useState<PolicyInput>({
    maxRiskScore: 70,
    minHealthFactor: 1.3,
    maxProtocolConcentration: 50,
    minLiquidityScore: 40,
  });

  const write = useMutation({
    mutationFn: () => writeRiskPolicy(draft),
    onSuccess: async (id) => {
      setTxid(id);
      setEditing(false);
      toast.success("Policy transaction submitted");
      // The contract write is not mined yet; refetch once it likely is.
      setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: ["policy", address] }),
        20_000,
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const field = (key: keyof PolicyInput, label: string, step: string, suffix: string) => (
    <div className="grid gap-1.5">
      <Label
        htmlFor={`policy-${key}`}
        className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground"
      >
        {label} ({suffix})
      </Label>
      <Input
        id={`policy-${key}`}
        type="number"
        step={step}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
        className="h-9"
      />
    </div>
  );

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
          owned by the wallet rather than by Rivisk. The worker reads them
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
            Deploy the Rivisk policy contract and set that variable to start
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
            No policy is stored on-chain for this wallet yet. Rivisk keeps
            using local alert rules until the wallet writes one.
          </p>
        )}
        {configured ? (
          <div className="mt-5 border-t border-border pt-5">
            {editing ? (
              <div className="grid gap-3 rounded-xl border border-border bg-elevated/50 p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {field("maxRiskScore", "Max risk score", "1", "/100")}
                  {field("minHealthFactor", "Min health factor", "0.01", "ratio")}
                  {field("maxProtocolConcentration", "Max concentration", "1", "%")}
                  {field("minLiquidityScore", "Min liquidity", "1", "%")}
                </div>
                <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
                  This writes to <code className="font-mono">risk-policy.clar</code>{" "}
                  from your wallet. The contract keys on the signing address, so
                  the limits belong to you, not to Rivisk. A network fee applies.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={write.isPending}
                    onClick={() => write.mutate()}
                    className="h-9 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
                  >
                    {write.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PenLine className="size-4" />
                    )}
                    {write.isPending ? "Waiting for wallet…" : "Sign and write policy"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <PenLine className="size-3.5" />
                {value ? "Update policy on-chain" : "Set a policy on-chain"}
              </Button>
            )}

            {txid ? (
              <a
                href={explorerTxUrl(txid)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-healthy/25 bg-healthy/[0.07] px-3 py-2 font-mono text-[0.75rem] text-healthy"
              >
                <ExternalLink className="size-3.5" />
                submitted · {txid.slice(0, 18)}…
              </a>
            ) : null}
          </div>
        ) : null}
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

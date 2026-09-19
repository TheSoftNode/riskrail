"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, Pause, Play } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { riskrailApi } from "@/lib/api";
import {
  formatMetric,
  METRIC_OPTIONS,
  metricLabel,
  OPERATOR_LABEL,
  toStoredThreshold,
} from "@/lib/risk";
import type { AlertMetric, AlertOperator } from "@/lib/types";

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function AlertsPanel({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const alerts = useQuery({
    queryKey: ["alerts", address],
    queryFn: () => riskrailApi.alerts(address),
  });

  const [metric, setMetric] = useState<AlertMetric>("healthFactorE4");
  const [operator, setOperator] = useState<AlertOperator>("lt");
  const [threshold, setThreshold] = useState("1.30");

  const selected = METRIC_OPTIONS.find((m) => m.value === metric)!;

  const create = useMutation({
    mutationFn: () =>
      riskrailApi.createAlert(address, {
        metric,
        operator,
        threshold: toStoredThreshold(metric, threshold),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["alerts", address] }),
  });

  const setStatus = useMutation({
    mutationFn: ({
      id,
      next,
    }: {
      id: string;
      next: "ACTIVE" | "PAUSED" | "ARCHIVED";
    }) => riskrailApi.setAlertStatus(id, next),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["alerts", address] }),
  });

  const rules = alerts.data?.rules ?? [];
  const breaches = alerts.data?.policyBreaches ?? [];

  return (
    <Card id="alerts" className="scroll-mt-24">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Monitoring
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
              Risk alerts
            </h2>
          </div>
          <Badge variant="outline" className="h-6 px-2.5 text-muted-foreground">
            In-app beta
          </Badge>
        </div>

        <p className="mt-3 text-[0.875rem] leading-relaxed text-muted-foreground">
          Rules are evaluated on every new risk snapshot and fire when a metric
          crosses into breach — not repeatedly while it stays there. Email and
          webhook delivery stay off until authenticated accounts land.
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-elevated/50 p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="alert-metric" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Metric
            </Label>
            <select
              id="alert-metric"
              value={metric}
              onChange={(e) => {
                const next = e.target.value as AlertMetric;
                setMetric(next);
                setThreshold(
                  METRIC_OPTIONS.find((m) => m.value === next)?.example ?? "0",
                );
              }}
              className={SELECT_CLASS}
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="alert-op" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Condition
            </Label>
            <select
              id="alert-op"
              value={operator}
              onChange={(e) => setOperator(e.target.value as AlertOperator)}
              className={SELECT_CLASS}
            >
              {Object.entries(OPERATOR_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="alert-threshold" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Threshold ({selected.unit})
            </Label>
            <Input
              id="alert-threshold"
              value={threshold}
              inputMode="decimal"
              onChange={(e) => setThreshold(e.target.value)}
              className="h-9"
            />
          </div>

          <Button
            disabled={create.isPending || !threshold}
            onClick={() => create.mutate()}
            className="h-9 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Add alert
          </Button>
        </div>

        {create.error ? (
          <p className="mt-3 rounded-lg border border-high/30 bg-high/10 px-3 py-2 text-[0.8125rem] text-high">
            {create.error.message}
          </p>
        ) : null}

        <div className="mt-5 space-y-2">
          {alerts.isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))
          ) : rules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
              No alert rules yet for this address.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-4 py-3"
              >
                <div>
                  <p className="text-[0.8125rem] font-medium">
                    {metricLabel(rule.metric)}
                  </p>
                  <p className="text-[0.75rem] text-muted-foreground">
                    {OPERATOR_LABEL[rule.operator] ?? rule.operator}{" "}
                    <span className="rr-tnum">
                      {formatMetric(rule.metric, rule.threshold)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={
                      rule.status === "ACTIVE"
                        ? "border-healthy/30 bg-healthy/10 text-healthy"
                        : "border-warning/30 bg-warning/10 text-warning"
                    }
                  >
                    {rule.status.toLowerCase()}
                  </Badge>
                  {rule.status !== "ARCHIVED" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate({
                          id: rule.id,
                          next: rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                        })
                      }
                    >
                      {rule.status === "ACTIVE" ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      {rule.status === "ACTIVE" ? "Pause" : "Resume"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {breaches.length > 0 ? (
          <div className="mt-6 border-t border-border pt-5">
            <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <BellRing className="size-3.5" />
              Recent on-chain policy breaches
            </p>
            <div className="mt-3 space-y-2">
              {breaches.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-high/25 bg-high/[0.07] px-3 py-2.5"
                >
                  <p className="text-[0.8125rem] font-medium">
                    {metricLabel(event.metric)}
                  </p>
                  <p className="rr-tnum text-[0.75rem] text-muted-foreground">
                    {formatMetric(event.metric, event.value)}{" "}
                    {OPERATOR_LABEL[event.operator] ?? event.operator}{" "}
                    {formatMetric(event.metric, event.threshold)}
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                    {new Date(event.triggeredAt).toLocaleString()} · block{" "}
                    {event.sourceBlock}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

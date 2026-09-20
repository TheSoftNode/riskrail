"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SecretReveal } from "@/components/dashboard/secret-reveal";
import { riskrailApi } from "@/lib/api";
import { WEBHOOK_EVENT_TYPES } from "@/lib/types";

export function WebhooksPanel() {
  const queryClient = useQueryClient();
  const hooks = useQuery({ queryKey: ["webhooks"], queryFn: () => riskrailApi.webhooks() });

  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["risk.updated"]);
  const [secret, setSecret] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["webhooks"] });

  const create = useMutation({
    mutationFn: () => riskrailApi.createWebhook(url.trim(), events),
    onSuccess: async (result) => {
      setSecret(result.secret);
      setUrl("");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      riskrailApi.setWebhookEnabled(id, enabled),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => riskrailApi.deleteWebhook(id),
    onSuccess: async () => {
      toast.success("Endpoint deleted");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card id="webhooks" className="scroll-mt-24">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Event delivery
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">Webhooks</h2>
          </div>
          <Badge variant="outline" className="h-6 px-2.5 text-muted-foreground">
            {hooks.data?.endpoints.length ?? 0} endpoints
          </Badge>
        </div>

        <p className="mt-3 max-w-3xl text-[0.875rem] leading-relaxed text-muted-foreground">
          Every payload is signed{" "}
          <code className="font-mono text-[0.8125rem] text-brand-text">
            riskrail-signature: t=&lt;unix&gt;,v1=&lt;hmac&gt;
          </code>{" "}
          over <code className="font-mono text-[0.8125rem]">timestamp.body</code>.
          Verify it before trusting a delivery. Failed attempts retry at 30s, 2m,
          10m and 1h.
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-elevated/50 p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="hook-url" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Endpoint URL (https)
            </Label>
            <Input
              id="hook-url"
              value={url}
              placeholder="https://example.com/riskrail"
              onChange={(e) => setUrl(e.target.value)}
              className="h-9 font-mono text-[0.8125rem]"
            />
          </div>

          <div className="grid gap-1.5">
            <span className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Events
            </span>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENT_TYPES.map((event) => {
                const on = events.includes(event);
                return (
                  <button
                    key={event}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setEvents((current) =>
                        current.includes(event)
                          ? current.filter((e) => e !== event)
                          : [...current, event],
                      )
                    }
                    className={`rounded-md border px-2 py-1 font-mono text-[0.6875rem] transition-colors ${
                      on
                        ? "border-brand/30 bg-brand/10 text-brand-text"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {event}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            disabled={create.isPending || url.trim().length === 0 || events.length === 0}
            onClick={() => create.mutate()}
            className="h-9 w-fit bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Webhook className="size-4" />}
            Add endpoint
          </Button>
        </div>

        {secret ? (
          <SecretReveal label="Signing secret" value={secret} onDismiss={() => setSecret(null)} />
        ) : null}

        <div className="mt-5 space-y-2">
          {hooks.isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : hooks.error ? (
            <p className="rounded-lg border border-high/30 bg-high/10 px-4 py-3 text-[0.8125rem] text-high">
              {hooks.error.message}
            </p>
          ) : (hooks.data?.endpoints.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
              No endpoints registered yet.
            </p>
          ) : (
            hooks.data!.endpoints.map((endpoint) => {
              const last = endpoint.deliveries[0];
              return (
                <div key={endpoint.id} className="rounded-xl border border-border bg-elevated/40 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[0.8125rem]">{endpoint.url}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1.5 font-mono text-[0.6875rem] text-muted-foreground">
                        {endpoint.events.map((e) => (
                          <span key={e}>{e}</span>
                        ))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          endpoint.enabled
                            ? "border-healthy/30 bg-healthy/10 text-healthy"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }
                      >
                        {endpoint.enabled ? "enabled" : "paused"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ id: endpoint.id, enabled: !endpoint.enabled })}
                      >
                        {endpoint.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(endpoint.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {last ? (
                    <p className="mt-2 border-t border-border/60 pt-2 font-mono text-[0.6875rem] text-muted-foreground">
                      last delivery{" "}
                      <span className={last.deliveredAt ? "text-healthy" : "text-high"}>
                        {last.statusCode ?? "network error"}
                      </span>{" "}
                      · attempt {last.attempt} ·{" "}
                      {new Date(last.createdAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

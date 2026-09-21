"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SecretReveal } from "@/components/dashboard/secret-reveal";
import { riviskApi } from "@/lib/api";

export function ApiKeysPanel() {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => riviskApi.apiKeys() });

  const [name, setName] = useState("");
  const [live, setLive] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => riviskApi.createApiKey(name.trim(), live),
    onSuccess: async (result) => {
      setIssued(result.token);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => riviskApi.revokeApiKey(id),
    onSuccess: async () => {
      toast.success("Key revoked");
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card id="api-keys" className="scroll-mt-24">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Developer access
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">API keys</h2>
          </div>
          <Badge variant="outline" className="h-6 px-2.5 text-muted-foreground">
            {keys.data?.keys.length ?? 0} active
          </Badge>
        </div>

        <p className="mt-3 max-w-3xl text-[0.875rem] leading-relaxed text-muted-foreground">
          Keys authenticate server-to-server calls. Rivisk stores only a
          peppered hash, so a key cannot be recovered after it is issued — revoke
          and replace it instead.
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-elevated/50 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="key-name" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Name
            </Label>
            <Input
              id="key-name"
              value={name}
              placeholder="Wallet integration"
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="key-env" className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Environment
            </Label>
            <select
              id="key-env"
              value={live ? "live" : "test"}
              onChange={(e) => setLive(e.target.value === "live")}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="test">rv_test_</option>
              <option value="live">rv_live_</option>
            </select>
          </div>
          <Button
            disabled={create.isPending || name.trim().length === 0}
            onClick={() => create.mutate()}
            className="h-9 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Create key
          </Button>
        </div>

        {issued ? (
          <SecretReveal label="API key" value={issued} onDismiss={() => setIssued(null)} />
        ) : null}

        <div className="mt-5 space-y-2">
          {keys.isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : keys.error ? (
            <p className="rounded-lg border border-high/30 bg-high/10 px-4 py-3 text-[0.8125rem] text-high">
              {keys.error.message}
            </p>
          ) : (keys.data?.keys.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
              No API keys yet.
            </p>
          ) : (
            keys.data!.keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium">{key.name}</p>
                  <p className="truncate font-mono text-[0.75rem] text-muted-foreground">
                    {key.prefix}…{" "}
                    <span className="text-muted-foreground/70">
                      {key.lastUsedAt
                        ? `last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                        : "never used"}
                    </span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(key.id)}
                >
                  <Trash2 className="size-3.5" />
                  Revoke
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

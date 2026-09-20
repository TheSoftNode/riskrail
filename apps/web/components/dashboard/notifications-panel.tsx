"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { riskrailApi } from "@/lib/api";

export function NotificationsPanel() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => riskrailApi.me() });

  const [email, setEmail] = useState("");
  const [notify, setNotify] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once, then leave the user's edits alone on refetch.
  useEffect(() => {
    if (profile.data && !loaded) {
      setEmail(profile.data.email ?? "");
      setNotify(profile.data.notifyByEmail);
      setLoaded(true);
    }
  }, [profile.data, loaded]);

  const save = useMutation({
    mutationFn: () =>
      riskrailApi.updateProfile({
        ...(email.trim() ? { email: email.trim() } : {}),
        notifyByEmail: notify,
      }),
    onSuccess: async () => {
      toast.success("Notification settings saved");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card id="notifications" className="scroll-mt-24">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Alerts
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
              Email notifications
            </h2>
          </div>
          {profile.data?.email ? (
            <Badge
              variant="outline"
              className={
                profile.data.emailVerified
                  ? "h-6 border-healthy/30 bg-healthy/10 px-2.5 text-healthy"
                  : "h-6 border-warning/30 bg-warning/10 px-2.5 text-warning"
              }
            >
              {profile.data.emailVerified ? "verified" : "unverified"}
            </Badge>
          ) : null}
        </div>

        <p className="mt-3 max-w-3xl text-[0.875rem] leading-relaxed text-muted-foreground">
          Alerts already appear in the dashboard the moment a snapshot lands.
          Add an address to receive them by email as well — one message per
          breach, not one per snapshot while it persists.
        </p>

        {profile.isLoading ? (
          <Skeleton className="mt-5 h-24 w-full" />
        ) : (
          <div className="mt-5 grid gap-3 rounded-xl border border-border bg-elevated/50 p-4">
            <div className="grid gap-1.5">
              <Label
                htmlFor="notify-email"
                className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground"
              >
                Email address
              </Label>
              <Input
                id="notify-email"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                className="h-9"
              />
            </div>

            <label className="flex items-center gap-2.5 text-[0.8125rem] text-muted-foreground">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="size-4 accent-[var(--brand)]"
              />
              Send alerts to this address
            </label>

            <Button
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="h-9 w-fit bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Save settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

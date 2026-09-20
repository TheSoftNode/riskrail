"use client";

import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasSession, sessionAddress, signIn, signOut } from "@/lib/auth";
import { shorten } from "@/lib/format";

/**
 * Developer settings are user-scoped, so they need a wallet session rather than
 * just an address in the URL. Rendered client-side only — the session lives in
 * localStorage and the server has no idea who is asking until the token arrives.
 */
export function SignInGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSignedIn(hasSession());
    setAddress(sessionAddress());
    setReady(true);
  }, []);

  async function start() {
    try {
      setBusy(true);
      const session = await signIn();
      setSignedIn(true);
      setAddress(session.address);
      await queryClient.invalidateQueries();
      toast.success("Signed in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  function end() {
    signOut();
    setSignedIn(false);
    setAddress(null);
    queryClient.clear();
    toast.success("Signed out");
  }

  if (!ready) return null;

  if (!signedIn) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="p-7">
          <span className="inline-flex size-10 items-center justify-center rounded-lg border border-brand/25 bg-brand/[0.08]">
            <Lock className="size-5 text-brand-text" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            Sign in with your wallet
          </h2>
          <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">
            API keys and webhooks belong to an account, so this page needs proof
            you control the address. Your wallet signs a one-time challenge — it
            is not a transaction, it moves no funds, and RiskRail never sees a
            private key.
          </p>
          <Button
            size="lg"
            disabled={busy}
            onClick={() => void start()}
            className="mt-7 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {busy ? "Waiting for signature…" : "Sign in with Stacks wallet"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-elevated/40 px-4 py-2.5">
        <span className="size-1.5 rounded-full bg-healthy" />
        <span className="font-mono text-[0.75rem] text-muted-foreground">
          Signed in as {shorten(address, 10, 6)}
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={end}>
          Sign out
        </Button>
      </div>
      {children}
    </>
  );
}

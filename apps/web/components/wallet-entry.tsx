"use client";

import { ArrowRight, Loader2, Lock, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectRiviskWallet } from "@/lib/wallet";

/**
 * The two ways into the dashboard: connect a wallet, or paste a public address
 * to read it without one.
 *
 * Shared between the "Open dashboard" modal and the dashboard's own empty
 * state, so someone who lands on /dashboard directly gets the same choice
 * rather than being sent back to the home page to start over.
 */
export function WalletEntry({
  onNavigate,
  autoFocus = false,
}: {
  /** Called just before navigating, so a containing modal can close itself. */
  onNavigate?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [address, setAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function go(value: string) {
    onNavigate?.();
    router.push(`/dashboard?address=${encodeURIComponent(value)}`);
  }

  function inspect(event: FormEvent) {
    event.preventDefault();
    const value = address.trim();
    // Shape check only - the API is the authority on whether a principal is real.
    if (!/^S[PTMN][0-9A-Z]{8,}$/i.test(value)) {
      setError("That does not look like a Stacks address. It should start with SP or ST.");
      return;
    }
    setError(null);
    go(value);
  }

  async function connect() {
    try {
      setError(null);
      setConnecting(true);
      go(await connectRiviskWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div>
      <Button
        size="lg"
        disabled={connecting}
        onClick={() => void connect()}
        className="w-full bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
      >
        {connecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {connecting ? "Waiting for your wallet…" : "Connect Stacks wallet"}
      </Button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={inspect}>
        <label
          htmlFor={inputId}
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Inspect any address
        </label>
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <Input
            id={inputId}
            value={address}
            autoFocus={autoFocus}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="SP… or ST…"
            aria-label="Stacks address"
            className="h-11 flex-1 font-mono text-[0.8125rem]"
          />
          <Button type="submit" size="lg" variant="outline" className="h-11 px-5">
            Analyze
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-high/30 bg-high/10 px-3 py-2 text-[0.8125rem] text-high"
        >
          {error}
        </p>
      ) : null}

      <p className="mt-4 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Read-only. Rivisk never takes custody, moves funds, or asks for a seed
        phrase.
      </p>
    </div>
  );
}

"use client";

import { ArrowRight, Loader2, Lock, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectRiviskWallet, restoreRiviskWallet } from "@/lib/wallet";
import { HeroBackdrop } from "./hero-backdrop";
import { RiskInstrument } from "./risk-instrument";

export function Hero() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void restoreRiviskWallet().then(setWallet);
  }, []);

  function inspect(event: FormEvent) {
    event.preventDefault();
    const value = address.trim();
    // Shape check only — the API is the authority on whether a principal is real.
    if (!/^S[PTMN][0-9A-Z]{8,}$/i.test(value)) {
      setError("That does not look like a Stacks address. It should start with SP or ST.");
      return;
    }
    setError(null);
    router.push(`/dashboard?address=${encodeURIComponent(value)}`);
  }

  async function connect() {
    try {
      setError(null);
      setConnecting(true);
      const value = await connectRiviskWallet();
      setWallet(value);
      router.push(`/dashboard?address=${encodeURIComponent(value)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <section className="relative overflow-hidden">
      <HeroBackdrop />

      <div className="rr-shell grid gap-12 pt-14 pb-20 lg:pt-24 lg:pb-32 xl:grid-cols-[minmax(0,1fr)_minmax(0,35rem)] xl:gap-20">
        <div className="flex flex-col">
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem] xl:text-[3.9rem]">
            Know where your{" "}
            <span className="rr-gradient-text">Bitcoin risk</span> lives.
          </h1>

          <p className="mt-8 max-w-2xl xl:mt-10 text-pretty text-base leading-[1.85] text-muted-foreground">
            Your sBTC sits in a wallet, a lending market and a payment stream at
            the same time — and every protocol only shows you its own slice.
            Rivisk reads all of them, normalizes the positions, and turns them
            into one explainable risk picture you can stress and verify.
          </p>

          <form onSubmit={inspect} className="mt-10 flex flex-col gap-2.5 sm:flex-row xl:mt-16">
            <Input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Paste any Stacks address — SP… or ST…"
              aria-label="Stacks address"
              className="h-11 flex-1 font-mono text-[0.8125rem]"
            />
            <Button
              type="submit"
              size="lg"
              className="h-11 bg-brand-solid px-5 text-primary-foreground hover:bg-brand-solid-hover"
            >
              Analyze address
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 xl:mt-6">
            <Button
              variant="outline"
              size="lg"
              onClick={() => void connect()}
              disabled={connecting}
              className="h-10"
            >
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wallet className="size-4" />
              )}
              {wallet ? "Open connected wallet" : "Connect Stacks wallet"}
            </Button>
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
              <Lock className="size-3.5" />
              Read-only. Rivisk never takes custody or asks for a seed phrase.
            </span>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-high/30 bg-high/10 px-3 py-2 text-[0.8125rem] text-high">
              {error}
            </p>
          ) : null}
        </div>

        <div>
          <RiskInstrument />
        </div>
      </div>
    </section>
  );
}

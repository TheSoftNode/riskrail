"use client";

import { ArrowRight } from "lucide-react";
import { OpenDashboardButton } from "@/components/open-dashboard-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "./primitives";

const PRINCIPLES = [
  {
    code: "01",
    title: "Non-custodial",
    body: "Public addresses in, analytics out. No seed phrases, no signing keys, no funds held.",
  },
  {
    code: "02",
    title: "Deterministic",
    body: "Risk is arithmetic, not a model. AI may explain a metric; it never computes one.",
  },
  {
    code: "03",
    title: "Explainable",
    body: "Unknown assets stay unvalued and coverage drops, rather than being quietly guessed.",
  },
  {
    code: "04",
    title: "Protocol-neutral",
    body: "Rivisk analyses venues without steering capital toward any of them.",
  },
];

export function ClosingCta() {
  return (
    <section className="border-t border-border bg-card/40">
      <div className="rr-shell py-20 lg:py-24">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06} className="bg-card">
              <div className="h-full p-6">
                <span className="font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground">
                  {p.code}
                </span>
                <h3 className="mt-3.5 text-[0.875rem] font-semibold tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-card px-6 py-14 text-center sm:px-10">
            <div
              aria-hidden
              className="rr-gradient pointer-events-none absolute -top-24 left-1/2 -z-10 h-56 w-[min(680px,90%)] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl"
            />
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl">
              Bitcoin capital became programmable.
              <br className="hidden sm:block" /> Give it observability.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
              Paste an address and see the whole position — wallet, lending and
              streams — scored, stressed and hashed in one pass.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <OpenDashboardButton
                size="lg"
                className="h-11 bg-brand-solid px-5 text-primary-foreground hover:bg-brand-solid-hover"
              >
                Open the dashboard
                <ArrowRight className="size-4" />
              </OpenDashboardButton>
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={
                  <a
                    href="https://github.com/TheSoftNode/rivisk"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                className="h-11 px-5"
              >
                Read the source
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

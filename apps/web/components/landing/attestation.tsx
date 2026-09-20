"use client";

import { Check, FileJson, Hash, Link2 } from "lucide-react";
import { IllustrativeTag, Reveal, SectionHeading } from "./primitives";

const CHAIN = [
  {
    icon: FileJson,
    title: "Canonical report",
    body: "Positions, prices, metrics, source block and methodology version, serialized deterministically.",
    mono: "snapshot-15.json",
  },
  {
    icon: Hash,
    title: "SHA-256 commitment",
    body: "The report is hashed off-chain. Change a single value and the digest no longer matches.",
    mono: "3f8a9b21…c6d120",
  },
  {
    icon: Link2,
    title: "Anchored in Clarity",
    body: "An authorized publisher writes the digest to risk-registry.clar with the source block and freshness. The contract and publisher are written; this step is disabled until they are deployed.",
    mono: "risk-registry.clar",
  },
];

export function Attestation() {
  return (
    <section id="attestation" className="border-t border-border">
      <div className="rr-shell py-20 lg:py-24">
        <div className="grid gap-12 [&>*]:min-w-0 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionHeading
                eyebrow="Attestations"
                title="Don't trust the dashboard. Re-hash the report."
                lede="The heavy analytics stay off-chain, where they can read prices and protocol state. What goes on-chain is the commitment — a 32-byte digest anyone can check against the JSON we served them. Hashing runs today; the publisher and registry contract are in the repository and switch on once deployed."
              />
            </Reveal>

            <Reveal delay={0.1}>
              <ul className="mt-8 space-y-3">
                {[
                  "Full report kept off-chain and served alongside its digest — running today",
                  "Snapshot history is append-only — nothing is overwritten",
                  "Freshness is readable on-chain, so stale risk can be rejected",
                  "Publisher key lives in a worker, never in the API process",
                  "On-chain publication stays off until the registry is deployed",
                  "Contracts hold zero user funds — reads only, by design",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-healthy" />
                    <span className="text-[0.875rem] leading-relaxed text-muted-foreground">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="relative overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full rounded-full bg-brand opacity-60 rr-breathe" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
                <span className="text-foreground">Attestation pipeline</span>
                <IllustrativeTag className="ml-auto" />
              </header>

              <ol className="space-y-1 p-5 pb-0 sm:p-6 sm:pb-0">
                {CHAIN.map((node, i) => (
                  <li key={node.title}>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/[0.08]">
                          <node.icon className="size-4 text-brand-text" />
                        </span>
                        {i < CHAIN.length - 1 ? (
                          <span className="my-1 w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="pb-6">
                        <h3 className="text-[0.875rem] font-semibold tracking-tight">
                          {node.title}
                        </h3>
                        <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                          {node.body}
                        </p>
                        <code className="mt-2 inline-block rounded-md border border-border bg-elevated px-2 py-1 font-mono text-[0.6875rem] text-brand-text">
                          {node.mono}
                        </code>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mx-5 mb-5 rounded-lg border border-healthy/25 bg-healthy/[0.07] px-3 py-2.5 sm:mx-6 sm:mb-6">
                <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-healthy">
                  <Check className="size-4" />
                  Digest matches the served report
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

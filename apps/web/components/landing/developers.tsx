"use client";

import { Code2 } from "lucide-react";
import { useState } from "react";
import { PlannedTag, Reveal, SectionHeading } from "./primitives";
import { cn } from "cn";

const TABS = {
  sdk: {
    label: "TypeScript SDK",
    planned: false,
    note: "Implemented in-repo. Not yet published to npm.",
    lines: [
      ['import { RiskRailClient } from ', '"@riskrail/sdk"', ";"],
      [""],
      ["const rr = ", "new RiskRailClient", "({ baseUrl, apiKey });"],
      [""],
      ["await", " rr.portfolios.risk(addr);"],
      ["await", " rr.simulations.run(addr, {"],
      ["  shocks: [{ symbol: ", '"sBTC"', ", changeBps: -2000 }],"],
      ["});"],
      ["await", " rr.webhooks.create(url, [", '"risk.updated"', "]);"],
    ],
  },
  rest: {
    label: "REST",
    planned: false,
    note: "Live on the API.",
    lines: [
      ["GET  /api/v1/portfolios/", "{address}", "/risk"],
      ["POST /api/v1/portfolios/", "{address}", "/refresh"],
      ["POST /api/v1/simulations"],
      [""],
      ["POST /api/v1/auth/challenge"],
      ["POST /api/v1/auth/verify"],
      [""],
      ["POST /api/v1/api-keys"],
      ["POST /api/v1/webhooks"],
    ],
  },
  hook: {
    label: "Webhook payload",
    planned: false,
    note: "Signature is HMAC-SHA256 over `timestamp.body`.",
    lines: [
      ["riskrail-signature: ", "t=1758…,v1=9f2c…"],
      ["riskrail-event-type: ", "risk.updated"],
      [""],
      ["{"],
      ['  "id": ', '"3f8a…"', ","],
      ['  "type": ', '"risk.updated"', ","],
      ['  "address": ', '"SP2ABC…"', ","],
      ['  "data": ', "{ healthFactorE4: 12700 }"],
      ["}"],
    ],
  },
} as const;

const CAPS = [
  {
    code: "WS",
    title: "Realtime",
    planned: false,
    body: "Address-scoped Socket.IO rooms push portfolio, risk and breach events the moment a snapshot lands.",
  },
  {
    code: "ALERT",
    title: "Edge-triggered alerts",
    planned: false,
    body: "A rule fires when a metric crosses into breach — not on every snapshot while it stays there.",
  },
  {
    code: "HOOK",
    title: "Signed webhooks",
    planned: false,
    body: "Risk events delivered to your endpoint, HMAC-signed with a per-endpoint secret, with delivery records and retry backoff.",
  },
];

export function Developers() {
  const [tab, setTab] = useState<keyof typeof TABS>("sdk");

  return (
    <section id="developers" className="border-t border-border">
      <div className="rr-shell py-20 lg:py-24">
        <div className="grid gap-12 [&>*]:min-w-0 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionHeading
                eyebrow="For developers"
                title="Don't rebuild a risk engine inside your wallet."
                lede="The same deterministic metrics the dashboard renders are available over REST, a typed client and signed webhooks — so wallets, treasuries and protocols can ship risk without owning an indexer."
              />
            </Reveal>

            <Reveal delay={0.1}>
              <ul className="mt-8">
                {CAPS.map((c) => (
                  <li
                    key={c.title}
                    className="flex gap-4 border-b border-border/60 py-4 first:border-t first:border-border/60"
                  >
                    <span className="mt-0.5 w-12 shrink-0 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-brand-text">
                      {c.code}
                    </span>
                    <div>
                      <h3 className="flex flex-wrap items-center gap-2 text-[0.875rem] font-semibold tracking-tight">
                        {c.title}
                        {c.planned ? <PlannedTag /> : null}
                      </h3>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                        {c.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-1 border-b border-border bg-elevated/60 px-3 py-2 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                <Code2 className="mr-1.5 size-3.5 text-muted-foreground" />
                {(Object.keys(TABS) as Array<keyof typeof TABS>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[0.75rem] transition-colors",
                      tab === key
                        ? "bg-brand/12 text-brand-text"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {TABS[key].label}
                  </button>
                ))}
              </div>

              <pre className="overflow-x-auto p-5 font-mono text-[0.78125rem] leading-[1.75]">
                <code>
                  {TABS[tab].lines.map((line, i) => (
                    <span key={i} className="block">
                      {line.join("").length === 0 ? (
                        " "
                      ) : (
                        line.map((part, j) => (
                          <span
                            key={j}
                            className={
                              j % 2 === 1 ? "text-brand-text" : "text-foreground"
                            }
                          >
                            {part}
                          </span>
                        ))
                      )}
                    </span>
                  ))}
                </code>
              </pre>

              <div className="border-t border-border px-5 py-3">
                <p className="text-[0.75rem] text-muted-foreground">
                  {TABS[tab].note} Responses carry the source block and
                  valuation coverage, so a caller always knows which chain state
                  a number came from.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

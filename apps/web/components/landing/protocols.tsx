"use client";

import { Badge } from "@/components/ui/badge";
import { Reveal, SectionHeading } from "./primitives";

const ADAPTERS = [
  {
    name: "Native Stacks",
    kind: "Wallet",
    status: "Live",
    tone: "healthy" as const,
    body: "STX plus SIP-010 balances with sBTC resolved per network, token metadata resolved before valuation, and exact on-chain quantities preserved even when pricing is unavailable.",
    surfaces: ["STX", "sBTC", "SIP-010"],
    validation: {
      tone: "healthy" as const,
      title: "Verified on mainnet",
      rows: [["Balance and FT reads", "live mainnet"]] as Array<[string, string]>,
      note: "Exercised against mainnet Hiro endpoints, including read-only contract calls.",
    },
  },
  {
    name: "Zest Protocol V2",
    kind: "Lending",
    status: "Live-validated",
    tone: "healthy" as const,
    body: "Reads the wallet obligation from the market vault, converts zToken collateral to underlying and scaled debt via the borrow index, then pulls borrow and liquidation LTVs straight from the egroup registry.",
    surfaces: ["Collateral", "Debt", "LTV bands"],
    // Numbers a reader can check themselves, rather than the word "integrated".
    // Source: docs/validation/zest-v2.md, mainnet obligation 762 at block 9031697.
    validation: {
      tone: "healthy" as const,
      title: "Verified on mainnet",
      note: "Checked against a live mainnet position, block 9031697.",
      rows: [
        ["Scaled debt read", "exact match"],
        ["Debt vs Zest own figure", "x0.99985"],
      ] as Array<[string, string]>,
    },
  },
  {
    name: "BitPay streams",
    kind: "Streaming",
    status: "Off in the beta",
    tone: "brand" as const,
    body: "Discovers sender and recipient streams and splits locked, vested, withdrawn and currently withdrawable sBTC — the capital a wallet owns economically but cannot spend right now.",
    surfaces: ["Locked", "Vested", "Withdrawable"],
    // Saying nothing here would let a reader assume the same level of proof as
    // the Zest card above, which has not been done for streams.
    validation: {
      tone: "warning" as const,
      title: "No contract to read yet",
      rows: [["Unit tested", "yes"], ["Live on current testnet", "no contract"]] as Array<[string, string]>,
      note: "The reader matches bitpay-core's interface, but no BitPay contract exists on the current Stacks testnet, so the adapter stays disabled in the beta.",
    },
  },
];

export function Protocols() {
  return (
    <section id="protocols" className="border-t border-border bg-card/40">
      <div className="rr-shell py-20 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Protocol adapters"
            title="Adapters understand protocols. Nothing above them has to."
            lede="Every venue implements the same interface and emits the same normalized position. Adding the next protocol does not mean touching the portfolio engine, the risk engine, the API or the dashboard."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {ADAPTERS.map((a, i) => (
            <Reveal key={a.name} delay={i * 0.08}>
              <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                <header className="flex items-center gap-2 border-b border-border px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                  <span className="text-muted-foreground">{a.kind}</span>
                  <Badge
                    variant="outline"
                    className={`ml-auto ${
                      a.tone === "healthy"
                        ? "border-healthy/30 bg-healthy/10 text-healthy"
                        : "border-brand/30 bg-brand/10 text-brand-text"
                    }`}
                  >
                    {a.status}
                  </Badge>
                </header>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[0.9375rem] font-semibold tracking-tight">
                    {a.name}
                  </h3>
                  <p className="mt-2.5 flex-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {a.body}
                  </p>

                  <div className="mt-5 border-t border-border/60 pt-3">
                    <p className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Reads
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.surfaces.map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-border bg-elevated px-2 py-0.5 font-mono text-[0.6875rem] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {"validation" in a && a.validation ? (
                    <div
                      className={`mt-4 rounded-lg border px-3 py-2.5 ${
                        a.validation.tone === "healthy"
                          ? "border-healthy/25 bg-healthy/[0.06]"
                          : "border-warning/25 bg-warning/[0.06]"
                      }`}
                    >
                      <p
                        className={`font-mono text-[0.5625rem] uppercase tracking-[0.12em] ${
                          a.validation.tone === "healthy" ? "text-healthy" : "text-warning"
                        }`}
                      >
                        {a.validation.title}
                      </p>
                      <dl className="mt-2 space-y-1">
                        {a.validation.rows.map(([k, v]) => (
                          <div
                            key={k}
                            className="flex flex-wrap items-baseline justify-between gap-x-3"
                          >
                            <dt className="text-[0.75rem] text-muted-foreground">
                              {k}
                            </dt>
                            <dd className="rr-tnum font-mono text-[0.75rem] text-foreground">
                              {v}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
                        {a.validation.note}
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.24}>
          <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-border bg-background">
            <div className="grid gap-6 [&>*]:min-w-0 p-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:p-8">
              <div>
                <h3 className="text-[0.9375rem] font-semibold tracking-tight">
                  Bring your own protocol
                </h3>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                  An adapter produces normalized collateral and debt assets plus
                  the protocol&apos;s own thresholds. Rivisk reuses the same
                  LTV, health-factor and liquidation arithmetic for all of them.
                </p>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-[0.75rem] leading-relaxed">
                <code>
                  <span className="text-muted-foreground">
                    {"// packages/adapter-core"}
                  </span>
                  {"\n"}
                  <span className="text-chart-2">interface</span>{" "}
                  <span className="text-brand-text">ProtocolAdapter</span> {"{\n"}
                  {"  metadata(): ProtocolMetadata;\n"}
                  {"  supports(addr, ctx): Promise<boolean>;\n"}
                  {"  getPositions(addr, ctx): Promise<\n"}
                  {"    NormalizedPosition[]\n"}
                  {"  >;\n"}
                  {"}"}
                </code>
              </pre>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

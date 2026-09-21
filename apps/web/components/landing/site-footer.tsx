import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Stress testing", href: "#stress" },
      { label: "Attestations", href: "#attestation" },
      { label: "Protocol adapters", href: "#protocols" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "API & SDK", href: "/docs/sdk" },
      { label: "Smart contracts", href: "/docs/contracts" },
      {
        label: "Documentation",
        href: "/docs",
      },
      {
        label: "Risk methodology",
        href: "https://github.com/TheSoftNode/rivisk/blob/main/documentation/10-risk-engine-methodology.md",
      },
      { label: "GitHub", href: "https://github.com/TheSoftNode/rivisk" },
    ],
  },
  {
    heading: "Project",
    links: [
      {
        label: "Security policy",
        href: "https://github.com/TheSoftNode/rivisk/blob/main/SECURITY.md",
      },
      {
        label: "Contributing",
        href: "https://github.com/TheSoftNode/rivisk/blob/main/CONTRIBUTING.md",
      },
      {
        label: "Roadmap",
        href: "https://github.com/TheSoftNode/rivisk/blob/main/documentation/23-roadmap.md",
      },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      {/* System strip — the same status vocabulary the instrument uses. */}
      <div className="border-b border-border bg-card/40">
        <div className="rr-shell flex flex-wrap items-center gap-x-4 gap-y-2 py-3 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-healthy opacity-60 rr-breathe" />
              <span className="relative inline-flex size-1.5 rounded-full bg-healthy" />
            </span>
            <span className="text-healthy">Beta</span>
          </span>
          <span className="text-border">/</span>
          <span>Stacks mainnet + testnet</span>
          <span className="text-border">·</span>
          <span>Methodology rivisk-v1.2</span>
          <span className="text-border">·</span>
          <span>Non-custodial · read-only</span>
          <span className="ml-auto">MIT</span>
        </div>
      </div>

      <div className="rr-shell py-14">
        <div className="grid gap-10 [&>*]:min-w-0 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div>
            <Link href="/" aria-label="Rivisk home">
              <Logo />
            </Link>
            <p className="mt-4 max-w-xs text-[0.8125rem] leading-relaxed text-muted-foreground">
              Non-custodial risk intelligence and on-chain attestations for
              Bitcoin capital on Stacks.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.75rem] text-muted-foreground">
            © {new Date().getFullYear()} Rivisk. Licensed under MIT.
          </p>
          <p className="max-w-lg text-[0.75rem] leading-relaxed text-muted-foreground">
            Rivisk provides analytics, not financial advice. Metrics are
            estimates derived from on-chain state and external price sources.
          </p>
        </div>
      </div>
    </footer>
  );
}

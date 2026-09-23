/**
 * The docs information architecture. The sidebar, the pager and the search
 * index all read from this one list, so a page cannot appear in one and be
 * missing from another.
 */

export interface DocPage {
  title: string;
  href: string;
  description: string;
  /** Extra terms the search should match that are not in the title. */
  keywords?: string[];
}

export interface DocGroup {
  title: string;
  pages: DocPage[];
}

export const DOCS_NAV: DocGroup[] = [
  {
    title: "Getting started",
    pages: [
      {
        title: "Introduction",
        href: "/docs",
        description: "What Rivisk is, who it is for, and the two ways to integrate.",
        keywords: ["overview", "infrastructure", "about"],
      },
      {
        title: "Quickstart",
        href: "/docs/quickstart",
        description: "Read a wallet's risk, stress it, and receive an event in a few minutes.",
        keywords: ["install", "first request", "tutorial"],
      },
      {
        title: "Core concepts",
        href: "/docs/concepts",
        description: "Positions, adapters, units, risk levels, coverage and freshness.",
        keywords: ["bps", "basis points", "health factor", "e4", "sentinel", "valuation coverage", "risk level"],
      },
    ],
  },
  {
    title: "Integrate",
    pages: [
      {
        title: "Authentication",
        href: "/docs/authentication",
        description: "Public reads, API keys, and wallet-signature sessions.",
        keywords: ["api key", "jwt", "sign in", "wallet", "challenge", "token", "rr_live", "rr_test"],
      },
      {
        title: "REST API",
        href: "/docs/api",
        description: "Every endpoint, its parameters, credentials and response.",
        keywords: ["endpoints", "reference", "portfolio", "risk", "simulation", "alerts", "policies"],
      },
      {
        title: "TypeScript SDK",
        href: "/docs/sdk",
        description: "The typed client: namespaces, sessions, retries and errors.",
        keywords: ["client", "RiviskClient", "typescript", "javascript", "retry"],
      },
      {
        title: "Webhooks",
        href: "/docs/webhooks",
        description: "Signed event delivery, verification and the retry schedule.",
        keywords: ["hmac", "signature", "events", "delivery", "verify"],
      },
      {
        title: "Realtime",
        href: "/docs/realtime",
        description: "Live portfolio and risk events over Socket.IO.",
        keywords: ["socket.io", "websocket", "subscribe", "live"],
      },
    ],
  },
  {
    title: "On-chain",
    pages: [
      {
        title: "Smart contracts",
        href: "/docs/contracts",
        description: "Deployed addresses, every public function, and error codes.",
        keywords: ["clarity", "testnet", "risk-registry", "risk-policy", "protocol-registry", "trait", "error codes"],
      },
      {
        title: "Consuming on-chain",
        href: "/docs/onchain",
        description: "Reading Rivisk from another Clarity contract, safely.",
        keywords: ["get-risk-if-fresh", "freshness", "sentinel", "use-trait", "consumer"],
      },
    ],
  },
  {
    title: "Operate",
    pages: [
      {
        title: "Errors and limits",
        href: "/docs/errors",
        description: "Status codes, error bodies, rate limits and what is safe to retry.",
        keywords: ["429", "rate limit", "retry-after", "401", "403", "400"],
      },
      {
        title: "Self-hosting",
        href: "/docs/self-hosting",
        description: "Run the API, indexer, worker and realtime service yourself.",
        keywords: ["environment", "env", "docker", "deploy", "config", "migrations"],
      },
      {
        title: "Project status",
        href: "/docs/status",
        description: "What is implemented, tested, deployed and live-validated.",
        keywords: ["roadmap", "planned", "validated", "maturity"],
      },
      {
        title: "Grant scope",
        href: "/docs/grant-scope",
        description: "What exists today versus what the Stacks Endowment grant would fund.",
        keywords: ["grant", "milestones", "roadmap", "funding", "ai", "explainer", "baseline"],
      },
    ],
  },
];

export const DOCS_PAGES: DocPage[] = DOCS_NAV.flatMap((group) => group.pages);

export function findDocPage(href: string): DocPage | undefined {
  return DOCS_PAGES.find((page) => page.href === href);
}

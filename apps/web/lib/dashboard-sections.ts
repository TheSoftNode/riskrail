import { Bell, FileLock2, KeyRound, Layers, LayoutGrid, Waves, type LucideIcon } from "lucide-react";

export interface DashboardSection {
  /** Route segment under /dashboard; "" is the overview. */
  segment: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /**
   * Belongs to the signed-in account rather than the wallet being inspected:
   * it needs no indexed portfolio and works without an address.
   */
  account?: boolean;
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    segment: "",
    label: "Overview",
    description: "Portfolio value, risk and exposure at a glance.",
    icon: LayoutGrid,
  },
  {
    segment: "positions",
    label: "Positions",
    description: "Every position the protocol adapters found for this wallet.",
    icon: Layers,
  },
  {
    segment: "stress",
    label: "Stress tests",
    description: "How the portfolio and its lending positions respond to price shocks.",
    icon: Waves,
  },
  {
    segment: "alerts",
    label: "Alerts",
    description: "Thresholds that notify you in the app, by email or by webhook when crossed.",
    icon: Bell,
  },
  {
    segment: "policy",
    label: "Risk policy",
    description: "Guardrails the wallet writes on chain, for contracts to check before acting.",
    icon: FileLock2,
  },
  {
    segment: "developers",
    label: "Developers",
    description: "API keys, webhooks and notification settings for your account.",
    icon: KeyRound,
    account: true,
  },
];

export function sectionHref(segment: string, address: string): string {
  const path = segment ? `/dashboard/${segment}` : "/dashboard";
  return address ? `${path}?address=${encodeURIComponent(address)}` : path;
}

/** The section a pathname belongs to; unknown paths fall back to the overview. */
export function sectionForPath(pathname: string): DashboardSection {
  const segment = pathname.replace(/^\/dashboard\/?/, "").split("/")[0] ?? "";
  return DASHBOARD_SECTIONS.find((s) => s.segment === segment) ?? DASHBOARD_SECTIONS[0]!;
}

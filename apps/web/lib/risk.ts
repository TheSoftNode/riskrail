import type { AlertMetric, RiskLevel } from "@/lib/types";

/** Semantic tone classes. Cyan is reserved for brand/interaction, never risk state. */
export const RISK_TONE: Record<
  RiskLevel,
  { text: string; badge: string; dot: string; label: string }
> = {
  healthy: {
    text: "text-healthy",
    badge: "border-healthy/30 bg-healthy/10 text-healthy",
    dot: "bg-healthy",
    label: "Healthy",
  },
  moderate: {
    text: "text-warning",
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
    label: "Moderate",
  },
  elevated: {
    text: "text-warning",
    badge: "border-warning/40 bg-warning/15 text-warning",
    dot: "bg-warning",
    label: "Elevated",
  },
  critical: {
    text: "text-high",
    badge: "border-high/30 bg-high/10 text-high",
    dot: "bg-high",
    label: "Critical",
  },
  unknown: {
    text: "text-muted-foreground",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    label: "Unknown",
  },
};

export const RISK_COPY: Record<RiskLevel, string> = {
  healthy:
    "No monitored lending position is close to its configured liquidation band.",
  moderate:
    "The portfolio carries measurable risk, but nothing is in an immediate critical condition.",
  elevated:
    "At least one monitored metric deserves attention. Review the lending and stress sections.",
  critical:
    "One or more monitored positions are at or beyond Rivisk's critical risk band.",
  unknown:
    "Not enough priced data yet to classify this portfolio with confidence.",
};

/**
 * Health factor is stored ×10,000; the risk score is 0–10,000 but reads as
 * /100; everything else ending in Bps is a true basis-point percentage.
 * Routing the score through the percent formatter is what made a "70" rule
 * render as "70.00%".
 */
export function formatMetric(metric: string, raw: string | number): string {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return String(raw);
  if (metric === "healthFactorE4") return (value / 10_000).toFixed(2);
  if (metric === "riskScoreBps") return `${(value / 100).toFixed(1)}/100`;
  if (metric.endsWith("Bps")) return `${(value / 100).toFixed(2)}%`;
  return String(raw);
}

/** Inverse of formatMetric for the alert builder: user input -> stored integer. */
export function toStoredThreshold(metric: AlertMetric, input: string): string {
  const value = Number(input);
  if (!Number.isFinite(value)) return input;
  if (metric === "healthFactorE4") return String(Math.round(value * 10_000));
  return String(Math.round(value * 100));
}

export const METRIC_OPTIONS: Array<{
  value: AlertMetric;
  label: string;
  unit: string;
  example: string;
}> = [
  { value: "healthFactorE4", label: "Health factor", unit: "ratio", example: "1.30" },
  { value: "liquidationDistanceBps", label: "Liquidation distance", unit: "%", example: "15" },
  { value: "riskScoreBps", label: "Risk score", unit: "/100", example: "70" },
  { value: "protocolConcentrationBps", label: "Protocol concentration", unit: "%", example: "50" },
  { value: "assetConcentrationBps", label: "Asset concentration", unit: "%", example: "50" },
  { value: "liquidityScoreBps", label: "Liquidity score", unit: "%", example: "40" },
  { value: "capitalAccessibilityBps", label: "Capital accessibility", unit: "%", example: "40" },
];

export const OPERATOR_LABEL: Record<string, string> = {
  lt: "falls below",
  lte: "is at or below",
  gt: "rises above",
  gte: "is at or above",
};

export function metricLabel(metric: string): string {
  return METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? metric;
}

/** Role -> chip tone. The old CSS only styled debt and collateral. */
export const ROLE_TONE: Record<string, string> = {
  collateral: "border-healthy/25 bg-healthy/10 text-healthy",
  debt: "border-high/25 bg-high/10 text-high",
  locked: "border-warning/25 bg-warning/10 text-warning",
  reward: "border-info/25 bg-info/10 text-info",
  asset: "border-border bg-muted text-muted-foreground",
};

export function roleTone(role: string): string {
  return ROLE_TONE[role] ?? ROLE_TONE.asset!;
}

/**
 * Sequential cyan ramp for share-of-total bars. One hue, stepped by lightness —
 * a categorical palette here would put near-identical blues side by side.
 */
export const EXPOSURE_RAMP = [
  "oklch(0.7971 0.1339 211.53)",
  "oklch(0.7148 0.1257 215.22)",
  "oklch(0.6089 0.1109 221.72)",
  "oklch(0.5198 0.0936 223.13)",
  "oklch(0.4344 0.0793 224.05)",
];

export function rampColor(index: number): string {
  return EXPOSURE_RAMP[Math.min(index, EXPOSURE_RAMP.length - 1)]!;
}

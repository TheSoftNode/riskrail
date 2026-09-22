"use client";

import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { ExposurePanel } from "@/components/dashboard/exposure-panel";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { PolicyPanel } from "@/components/dashboard/policy-panel";
import { PositionsPanel } from "@/components/dashboard/positions-panel";
import { RiskPanel } from "@/components/dashboard/risk-panel";
import { StressPanel } from "@/components/dashboard/stress-panel";

/** One component per dashboard page. State comes from the layout's frame. */

export function OverviewView() {
  const { portfolio, risk, firstLoad } = useDashboard();
  const hasSnapshot = Boolean(portfolio.data?.sourceBlock);
  return (
    <div className="space-y-3">
      <OverviewCards portfolio={portfolio.data} loading={firstLoad} />
      <RiskPanel risk={risk.data} loading={firstLoad || (hasSnapshot && risk.isLoading)} />
      <ExposurePanel portfolio={portfolio.data} loading={firstLoad} />
    </div>
  );
}

export function PositionsView() {
  const { portfolio, firstLoad } = useDashboard();
  return <PositionsPanel positions={portfolio.data?.positions ?? []} loading={firstLoad} />;
}

export function StressView() {
  return <StressPanel address={useDashboard().address} />;
}

export function AlertsView() {
  return <AlertsPanel address={useDashboard().address} />;
}

export function PolicyView() {
  return <PolicyPanel address={useDashboard().address} />;
}

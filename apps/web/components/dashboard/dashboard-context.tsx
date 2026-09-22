"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { riviskApi } from "@/lib/api";

type PortfolioResponse = Awaited<ReturnType<typeof riviskApi.portfolio>>;
type RiskResponse = Awaited<ReturnType<typeof riviskApi.risk>>;

/**
 * What every dashboard page shares. The frame (in the layout) owns the
 * queries, the realtime connection and the indexing state, so switching
 * between pages neither refetches nor reconnects.
 */
export interface DashboardState {
  address: string;
  portfolio: UseQueryResult<PortfolioResponse>;
  risk: UseQueryResult<RiskResponse>;
  /** The first portfolio request has not come back yet. */
  firstLoad: boolean;
}

export const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard(): DashboardState {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside the dashboard layout");
  return value;
}

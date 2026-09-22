import { Suspense, type ReactNode } from "react";
import { DashboardFrame } from "@/components/dashboard/dashboard-frame";

export const metadata = { title: { default: "Dashboard", template: "%s · Rivisk" } };

// Layouts don't receive searchParams, so the frame reads `?address=` on the
// client; useSearchParams needs a Suspense boundary to prerender around it.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <DashboardFrame>{children}</DashboardFrame>
    </Suspense>
  );
}

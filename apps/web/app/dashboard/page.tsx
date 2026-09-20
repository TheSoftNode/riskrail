import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { WalletEntry } from "@/components/wallet-entry";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const params = await searchParams;
  const address = params.address?.trim() ?? "";

  if (!address) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14 sm:px-8">
        <Link href="/" aria-label="RiskRail home">
          <Logo />
        </Link>
        <Card className="mt-14">
          <CardContent className="p-8">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              No address selected
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Start with a Stacks address.
            </h1>
            <p className="mt-3 mb-8 text-[0.9375rem] leading-relaxed text-muted-foreground">
              Connect a wallet to load your own portfolio, or paste any public
              address to inspect it read-only.
            </p>
            {/* Offering the choice here rather than a link home: someone who
                arrives at this URL directly should be able to finish from it. */}
            <WalletEntry />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[0.8125rem] text-muted-foreground">
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            Back to RiskRail
          </Link>
        </p>
      </main>
    );
  }

  return <DashboardClient initialAddress={address} />;
}

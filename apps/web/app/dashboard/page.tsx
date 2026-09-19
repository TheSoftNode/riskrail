import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Button } from "@/components/ui/button";
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
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
              Head back to the home page and connect a wallet, or paste any
              public address to inspect it read-only.
            </p>
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/" />}
              className="mt-8 bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover"
            >
              <ArrowLeft className="size-4" />
              Back to RiskRail
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <DashboardClient initialAddress={address} />;
}

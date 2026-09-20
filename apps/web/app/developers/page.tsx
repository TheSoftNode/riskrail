import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { SignInGate } from "@/components/dashboard/sign-in-gate";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Developer settings" };

export default function DevelopersPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="RiskRail home">
          <Logo />
        </Link>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/dashboard" />}>
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Button>
      </div>

      <div className="mt-10">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          For developers
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight">
          Keys and event delivery
        </h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-[1.8] text-muted-foreground">
          Issue credentials for server-to-server calls and subscribe an endpoint
          to risk events. Both secrets are shown once at creation.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <SignInGate>
          <NotificationsPanel />
          <ApiKeysPanel />
          <WebhooksPanel />
        </SignInGate>
      </div>
    </main>
  );
}

import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { SignInGate } from "@/components/dashboard/sign-in-gate";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";

export const metadata = { title: "Developers" };

export default function DevelopersPage() {
  return (
    <div className="max-w-5xl space-y-3">
      <SignInGate>
        <NotificationsPanel />
        <ApiKeysPanel />
        <WebhooksPanel />
      </SignInGate>
    </div>
  );
}

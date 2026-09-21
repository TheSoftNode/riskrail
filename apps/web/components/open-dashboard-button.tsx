"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WalletEntry } from "@/components/wallet-entry";
import { restoreRiviskWallet } from "@/lib/wallet";

/**
 * "Open dashboard" that does not dead-end.
 *
 * With a connected wallet it goes straight to that address. Without one it used
 * to navigate to /dashboard, which could only tell the visitor to go back where
 * they came from - so instead it opens the choice in place.
 *
 * It stays a real link rather than becoming a button: the href is correct for
 * middle-click and "open in new tab", and the click handler only intercepts the
 * case where there is nowhere useful to go yet.
 */
export function OpenDashboardButton({
  className,
  size = "sm",
  children,
  onNavigate,
  render,
}: {
  className?: string;
  size?: "sm" | "lg" | "default";
  children: ReactNode;
  /** Lets a containing mobile sheet close itself. */
  onNavigate?: () => void;
  /** Render as a plain anchor instead of a Button (for the mobile sheet). */
  render?: "anchor";
}) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void restoreRiviskWallet().then(setWallet);
  }, []);

  const href = wallet
    ? `/dashboard?address=${encodeURIComponent(wallet)}`
    : "/dashboard";

  function onClick(event: React.MouseEvent) {
    if (wallet) {
      onNavigate?.();
      return;
    }
    // Leave modified clicks alone so "open in new tab" still works.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate?.();
    setOpen(true);
  }

  const link = <Link href={href} onClick={onClick} />;

  return (
    <>
      {render === "anchor" ? (
        <Link href={href} onClick={onClick} className={className}>
          {children}
        </Link>
      ) : (
        <Button size={size} nativeButton={false} render={link} className={className}>
          {children}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start with a Stacks address</DialogTitle>
            <DialogDescription>
              Connect a wallet to load your own portfolio, or paste any public
              address to inspect it read-only.
            </DialogDescription>
          </DialogHeader>
          <WalletEntry autoFocus onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

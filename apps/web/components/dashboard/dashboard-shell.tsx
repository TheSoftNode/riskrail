"use client";

import { KeyRound, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DASHBOARD_SECTIONS, sectionForPath, sectionHref } from "@/lib/dashboard-sections";
import { cn } from "cn";

export function DashboardShell({
  topbar,
  address,
  children,
}: {
  topbar: ReactNode;
  /** Carried into every section link so switching pages keeps the wallet. */
  address: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = sectionForPath(pathname).segment;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-1 flex-col lg:grid lg:grid-cols-[16.25rem_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="sticky top-0 z-40 border-b border-border bg-sidebar/90 backdrop-blur-xl lg:h-svh lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center gap-3 px-4 lg:h-auto lg:px-5 lg:pt-6">
          <Link href="/" aria-label="Rivisk home">
            <Logo />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? "Close sections" : "Open sections"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="ml-auto lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>

        <nav
          className={cn(
            "flex-col gap-0.5 px-3 pb-4 lg:mt-8 lg:flex lg:px-3",
            open ? "flex" : "hidden",
          )}
        >
          {DASHBOARD_SECTIONS.map((s) => (
            <Link
              key={s.segment || "overview"}
              href={sectionHref(s.segment, address)}
              onClick={() => setOpen(false)}
              aria-current={active === s.segment ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] transition-colors",
                active === s.segment
                  ? "bg-brand/10 font-medium text-brand-text"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <s.icon className="size-4" />
              {s.label}
            </Link>
          ))}
        </nav>

        <div className={cn("px-3 pb-4 lg:mt-2 lg:block", open ? "block" : "hidden")}>
          <Link
            href="/developers"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <KeyRound className="size-4" />
            Developers
          </Link>
        </div>

        <div className="hidden items-center gap-2 px-5 pb-6 lg:absolute lg:bottom-0 lg:flex">
          <span className="size-1.5 rounded-full bg-brand" />
          <span className="text-[0.6875rem] capitalize text-muted-foreground">
            {process.env.NEXT_PUBLIC_STACKS_NETWORK ?? "mainnet"}
          </span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl lg:top-0">
          <div className="mx-auto flex w-full max-w-[120rem] min-h-16 items-center gap-3 px-5 py-2.5 sm:px-8 lg:px-10">
            {topbar}
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[120rem] flex-1 px-5 pt-6 pb-24 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

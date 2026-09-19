"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#stress", label: "Stress testing" },
  { href: "#attestation", label: "Attestations" },
  { href: "#protocols", label: "Protocols" },
  { href: "#developers", label: "Developers" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 1024px)");
    const onWide = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-200",
        scrolled || open
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="rr-shell flex h-16 items-center gap-6">
        <Link href="/" aria-label="RiskRail home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href="https://github.com/TheSoftNode/riskrail"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
          >
            GitHub
          </a>
          <ThemeToggle />
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard" />}
            className="hidden bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover sm:inline-flex"
          >
            Open dashboard
            <ArrowUpRight className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="absolute inset-x-0 top-16 border-b border-t border-border bg-background shadow-2xl lg:hidden">
          <nav className="rr-shell flex flex-col py-3">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-brand-solid px-3 py-2.5 text-center text-sm font-medium text-primary-foreground"
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

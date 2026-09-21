"use client";

import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { OpenDashboardButton } from "@/components/open-dashboard-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#stress", label: "Stress testing" },
  { href: "#attestation", label: "Attestations" },
];

/**
 * Three sections answer the same question from different sides -- what Rivisk
 * reads, who reads Rivisk, and how you call it -- so they collapse into one
 * nav entry rather than three that a reader has to tell apart. The hints are
 * what make the grouping legible; without them "Protocols" and "Integrations"
 * sitting together is a guess.
 */
const INTEGRATIONS = {
  label: "Integrations",
  items: [
    { href: "#protocols", label: "Protocol adapters", hint: "What Rivisk reads" },
    { href: "#consumers", label: "Who consumes it", hint: "Products built on top" },
    { href: "#developers", label: "API, SDK and Clarity", hint: "How to call it" },
  ],
};

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
      <div className="rr-shell flex h-16 items-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" aria-label="Rivisk home">
          <Logo />
        </Link>

        {/* Centred rather than tucked against the logo: with four items and a
            shell that widens to 108rem, hugging the left leaves a large dead
            gap across the middle of wide screens. */}
        <nav className="hidden items-center gap-1 lg:flex lg:justify-self-center">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
            >
              {INTEGRATIONS.label}
              <ChevronDown className="size-3.5 transition-transform duration-150 in-data-[popup-open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-1.5">
              {INTEGRATIONS.items.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  className="cursor-pointer flex-col items-start gap-0.5 px-2.5 py-2"
                  render={<a href={item.href} />}
                >
                  <span className="text-[0.8125rem] font-medium">{item.label}</span>
                  <span className="text-[0.75rem] text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground">
                    {item.hint}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/docs"
            className="rounded-lg px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Docs
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0 lg:justify-self-end">
          <ThemeToggle />
          <OpenDashboardButton className="hidden bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover sm:inline-flex">
            Open dashboard
            <ArrowUpRight className="size-3.5" />
          </OpenDashboardButton>
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

            {/* A dropdown inside an already-open sheet is friction, so the
                group is flattened here and kept legible with a heading. */}
            <p className="mt-2 px-2 pb-1 pt-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              {INTEGRATIONS.label}
            </p>
            {INTEGRATIONS.items.map((item) => (
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
              href="/docs"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg px-2 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Documentation
            </Link>
            <OpenDashboardButton
              render="anchor"
              onNavigate={() => setOpen(false)}
              className="mt-2 rounded-lg bg-brand-solid px-3 py-2.5 text-center text-sm font-medium text-primary-foreground"
            >
              Open dashboard
            </OpenDashboardButton>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

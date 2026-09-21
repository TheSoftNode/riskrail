"use client";

import { ArrowUpRight, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { OpenDashboardButton } from "@/components/open-dashboard-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DOCS_NAV, DOCS_PAGES, type DocPage } from "@/lib/docs-nav";
import { cn } from "cn";

function useIsMac() {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return mac;
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-7">
      {DOCS_NAV.map((group) => (
        <div key={group.title}>
          <p className="px-3 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-[0.84375rem] transition-colors",
                      active
                        ? "bg-brand/10 font-medium text-brand-text"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function matches(page: DocPage, query: string) {
  const hay = [page.title, page.description, ...(page.keywords ?? [])].join(" ").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

/**
 * Searches page titles, descriptions and keywords. Deliberately not full-text:
 * the docs are small enough that a page-level index answers "where is X" and
 * stays instant without shipping an index of every paragraph.
 */
function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const results = useMemo(
    () => (query.trim() ? DOCS_PAGES.filter((p) => matches(p, query)) : DOCS_PAGES),
    [query],
  );

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(page: DocPage | undefined) {
    if (!page) return;
    onOpenChange(false);
    router.push(page.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Search the documentation</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[cursor]);
              }
            }}
            placeholder="Search the docs: webhooks, freshness, 429…"
            aria-label="Search the documentation"
            className="h-12 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="max-h-[22rem] overflow-y-auto p-1.5" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-[0.84375rem] text-muted-foreground">
              Nothing matches &ldquo;{query}&rdquo;.
            </li>
          ) : (
            results.map((page, i) => (
              <li key={page.href} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(page)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left",
                    i === cursor ? "bg-brand/10" : "hover:bg-muted",
                  )}
                >
                  <span className={cn("text-[0.875rem] font-medium", i === cursor ? "text-brand-text" : "text-foreground")}>
                    {page.title}
                  </span>
                  <span className="text-[0.78125rem] leading-snug text-muted-foreground">{page.description}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mac = useIsMac();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const firstRender = useRef(true);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearch(true);
      } else if (e.key === "Escape") {
        setMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="rr-shell flex h-14 items-center gap-3">
          <Link href="/" aria-label="Rivisk home" className="shrink-0">
            <Logo />
          </Link>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <Link href="/docs" className="hidden text-[0.875rem] font-medium text-foreground sm:block">
            Docs
          </Link>

          <button
            type="button"
            onClick={() => setSearch(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground sm:ml-6 sm:w-64"
            aria-label="Search the documentation"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Search docs</span>
            <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 font-mono text-[0.625rem] sm:inline">
              {mac ? "⌘" : "Ctrl"} K
            </kbd>
          </button>

          <div className="flex items-center gap-1.5 sm:ml-auto">
            <ThemeToggle />
            <OpenDashboardButton className="hidden bg-brand-solid text-primary-foreground hover:bg-brand-solid-hover md:inline-flex">
              Open dashboard
              <ArrowUpRight className="size-3.5" />
            </OpenDashboardButton>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              {menu ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {menu ? (
        <div className="fixed inset-x-0 top-14 bottom-0 z-30 overflow-y-auto border-t border-border bg-background px-4 py-6 lg:hidden">
          <SidebarNav onNavigate={() => setMenu(false)} />
          {/* The header hides this below md, so the drawer is the only way to
              reach the app from the docs on a phone. */}
          <div className="mt-8 border-t border-border pt-6">
            <OpenDashboardButton
              render="anchor"
              onNavigate={() => setMenu(false)}
              className="block rounded-lg bg-brand-solid px-3 py-2.5 text-center text-sm font-medium text-primary-foreground"
            >
              Open dashboard
            </OpenDashboardButton>
          </div>
        </div>
      ) : null}

      <div className="rr-shell flex-1 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <aside className="hidden lg:block">
          <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto py-10 pr-2">
            <SidebarNav />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>

      <SearchDialog open={search} onOpenChange={setSearch} />
    </div>
  );
}

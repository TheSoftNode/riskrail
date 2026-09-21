"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_PAGES } from "@/lib/docs-nav";

/** Previous and next page, following the sidebar order. */
export function DocsPager() {
  const pathname = usePathname();
  const index = DOCS_PAGES.findIndex((p) => p.href === pathname);
  if (index === -1) return null;
  const prev = DOCS_PAGES[index - 1];
  const next = DOCS_PAGES[index + 1];

  return (
    <nav aria-label="Pagination" className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className="group rounded-xl border border-border px-4 py-3 transition-colors hover:border-brand/40 hover:bg-muted/40">
          <span className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            <ArrowLeft className="size-3" /> Previous
          </span>
          <span className="mt-1 block text-[0.9375rem] font-medium text-foreground group-hover:text-brand-text">{prev.title}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link href={next.href} className="group rounded-xl border border-border px-4 py-3 text-right transition-colors hover:border-brand/40 hover:bg-muted/40 sm:col-start-2">
          <span className="flex items-center justify-end gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            Next <ArrowRight className="size-3" />
          </span>
          <span className="mt-1 block text-[0.9375rem] font-medium text-foreground group-hover:text-brand-text">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}

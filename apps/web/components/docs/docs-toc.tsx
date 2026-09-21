"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "cn";

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * On-page contents, built from the rendered headings rather than declared per
 * page, so it cannot fall out of step with the content. Endpoint sections carry
 * a `data-toc` label, since their visible header is a badge plus a path.
 */
export function DocsToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("article h2[id], article h3[id], article section[data-toc]"),
    );
    setHeadings(
      nodes.map((n) => ({
        id: n.id,
        // Strip the trailing "#" anchor the heading renders.
        text: n.dataset.toc ?? (n.textContent ?? "").replace(/#\s*$/, "").trim(),
        // Endpoints nest under their section heading, like an h3.
        level: n.tagName === "H3" || n.dataset.tocLevel === "3" ? 3 : 2,
      })),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [pathname]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-[0.8125rem]">
      <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        On this page
      </p>
      <ul className="mt-3 space-y-1.5 border-l border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={cn(
                "-ml-px block border-l py-0.5 leading-snug transition-colors",
                h.level === 3 ? "pl-6" : "pl-3",
                active === h.id
                  ? "border-brand-text font-medium text-brand-text"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

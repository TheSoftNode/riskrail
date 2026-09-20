"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "cn";
import type { ReactNode } from "react";

/** Scroll-reveal wrapper. Collapses to a no-op when the OS asks for less motion. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Small uppercase section kicker. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Marks mocked figures. Every number on this page is a worked example, not a
 * live reading, and it should say so rather than implying a real portfolio.
 */
export function IllustrativeTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      <span className="size-1 rounded-full bg-muted-foreground/70" />
      Illustrative
    </span>
  );
}

/**
 * Marks a capability the repository does not implement yet. Distinct from
 * IllustrativeTag, which marks real features shown with worked-example numbers.
 */
export function PlannedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-warning",
        className,
      )}
    >
      <span className="size-1 rounded-full bg-warning" />
      Planned
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="max-w-4xl text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
        {title}
      </h2>
      {lede ? (
        <p className="max-w-3xl text-pretty text-[0.9375rem] leading-[1.8] text-muted-foreground">
          {lede}
        </p>
      ) : null}
    </div>
  );
}

import { AlertTriangle, Info, OctagonAlert, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Building blocks for documentation pages.
 *
 * Pages are written in TSX with these rather than Markdown so every heading
 * carries a stable id (the table of contents and deep links depend on it) and
 * every table, callout and endpoint header renders in the same design system as
 * the rest of the app.
 */

export function DocHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
}) {
  return (
    <header className="border-b border-border pb-8">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-[2.25rem] sm:leading-[1.15]">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-pretty text-[1rem] leading-[1.8] text-muted-foreground">
        {lede}
      </p>
    </header>
  );
}

function Anchor({ id }: { id: string }) {
  return (
    <a
      href={`#${id}`}
      aria-label="Link to this section"
      className="ml-2 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-brand-text"
    >
      #
    </a>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-14 scroll-mt-24 text-[1.4rem] font-semibold tracking-tight first:mt-10"
    >
      {children}
      <Anchor id={id} />
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="group mt-9 scroll-mt-24 text-[1.0625rem] font-semibold tracking-tight">
      {children}
      <Anchor id={id} />
    </h3>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-4 text-[0.9375rem] leading-[1.85] text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground", className)}>
      {children}
    </p>
  );
}

/**
 * Inline code. Kept in the text colour; cyan is reserved for interaction.
 * Stacks principals are 40+ characters with no break points, so it may wrap
 * anywhere -- otherwise one address pushes a phone layout sideways.
 */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.8125em] text-foreground [overflow-wrap:anywhere]">
      {children}
    </code>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="font-medium text-brand-text underline decoration-brand-text/30 underline-offset-4 transition-colors hover:decoration-brand-text"
    >
      {children}
    </a>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 space-y-2 pl-5 text-[0.9375rem] leading-[1.8] text-muted-foreground marker:text-border [&_strong]:font-semibold [&_strong]:text-foreground list-disc">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 space-y-2 pl-5 text-[0.9375rem] leading-[1.8] text-muted-foreground marker:font-mono marker:text-[0.8125rem] marker:text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground list-decimal">
      {children}
    </ol>
  );
}

/**
 * Header cells use the uppercase label style. `uppercase` would also rewrite a
 * field name -- healthFactorE4 becomes HEALTHFACTORE4, which a reader then
 * types -- so anything wrapped in <C> keeps its case.
 */
export function Table({
  head,
  rows,
  className,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  className?: string;
}) {
  return (
    <div className={cn("mt-5 overflow-x-auto rounded-xl border border-border", className)}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-[0.84375rem]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {head.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground [&_code]:normal-case [&_code]:tracking-normal"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border/60 last:border-0 align-top">
              {row.map((cell, c) => (
                <td key={c} className="px-4 py-3 leading-relaxed text-muted-foreground [&_code]:text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CALLOUT = {
  note: { icon: Info, label: "Note", tone: "border-info/30 bg-info/[0.06]", ink: "text-info" },
  warning: { icon: AlertTriangle, label: "Warning", tone: "border-warning/30 bg-warning/[0.06]", ink: "text-warning" },
  danger: { icon: OctagonAlert, label: "Important", tone: "border-high/30 bg-high/[0.06]", ink: "text-high" },
  success: { icon: CheckCircle2, label: "Verified", tone: "border-healthy/30 bg-healthy/[0.06]", ink: "text-healthy" },
} as const;

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: keyof typeof CALLOUT;
  title?: string;
  children: ReactNode;
}) {
  const c = CALLOUT[type];
  const Icon = c.icon;
  return (
    <aside className={cn("mt-6 flex gap-3 rounded-xl border px-4 py-3.5", c.tone)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", c.ink)} aria-hidden />
      <div className="min-w-0 text-[0.875rem] leading-[1.75] text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&>p:first-child]:mt-0 [&_p]:mt-2 [&_p]:text-[0.875rem]">
        <p className={cn("font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em]", c.ink)}>
          {title ?? c.label}
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </aside>
  );
}

const METHOD_TONE: Record<string, string> = {
  GET: "border-info/30 bg-info/10 text-info",
  POST: "border-healthy/30 bg-healthy/10 text-healthy",
  PATCH: "border-warning/30 bg-warning/10 text-warning",
  DELETE: "border-high/30 bg-high/10 text-high",
};

export type Credential = "public" | "key-or-session" | "session";

const CREDENTIAL: Record<Credential, string> = {
  public: "No credential",
  "key-or-session": "API key or session",
  session: "Wallet session only",
};

/** The header for one REST endpoint: method, path, the credential it takes. */
export function Endpoint({
  id,
  method,
  path,
  auth,
  children,
}: {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  auth: Credential;
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      data-toc={`${method} ${path}`}
      data-toc-level="3"
      className="group mt-12 scroll-mt-24 border-t border-border pt-8 first:border-0"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] font-semibold", METHOD_TONE[method])}>
          {method}
        </span>
        <code className="break-all font-mono text-[0.9375rem] font-medium text-foreground">{path}</code>
        <a href={`#${id}`} aria-label="Link to this endpoint" className="text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-brand-text">
          #
        </a>
        <span className="ml-auto rounded-full border border-border px-2.5 py-0.5 text-[0.6875rem] text-muted-foreground">
          {CREDENTIAL[auth]}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Field list for request bodies and query parameters. */
export function Fields({
  fields,
}: {
  fields: Array<{ name: string; type: string; required?: boolean; children: ReactNode }>;
}) {
  return (
    <dl className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
      {fields.map((f) => (
        <div key={f.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
          <dt className="flex flex-wrap items-baseline gap-x-2">
            <code className="font-mono text-[0.8125rem] font-medium text-foreground">{f.name}</code>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">{f.type}</span>
            {f.required ? (
              <span className="font-mono text-[0.625rem] uppercase tracking-wider text-warning">required</span>
            ) : null}
          </dt>
          <dd className="text-[0.84375rem] leading-relaxed text-muted-foreground [&_code]:text-foreground">
            {f.children}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Numbered procedure, for setup steps a reader follows in order. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-6 space-y-8 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="relative pl-10 [counter-increment:step] before:absolute before:left-0 before:top-0 before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:border before:border-border before:bg-card before:font-mono before:text-[0.75rem] before:text-muted-foreground before:content-[counter(step)]">
      <p className="pt-0.5 text-[0.9375rem] font-semibold tracking-tight text-foreground">{title}</p>
      <div className="[&>p:first-child]:mt-2">{children}</div>
    </li>
  );
}

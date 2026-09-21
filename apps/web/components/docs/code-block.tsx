"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

/**
 * Comment syntax per language. Comments are dimmed so the eye lands on the code
 * itself -- that is the only highlighting. Full syntax colouring would pull in a
 * tokenizer for a few hundred lines of examples, and would compete with the
 * palette rule that cyan means interaction.
 */
const COMMENT: Record<string, RegExp> = {
  ts: /\/\/.*$/,
  js: /\/\/.*$/,
  clarity: /;;.*$/,
  bash: /(^|\s)#.*$/,
  env: /^\s*#.*$/,
  http: /$^/,
  json: /$^/,
  text: /$^/,
};

function Line({ text, lang }: { text: string; lang: string }) {
  const rule = COMMENT[lang] ?? COMMENT.text!;
  const match = text.match(rule);
  if (!match || match.index === undefined) return <>{text || " "}</>;
  return (
    <>
      {text.slice(0, match.index)}
      <span className="text-muted-foreground/70">{text.slice(match.index)}</span>
    </>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard can be refused (insecure context, permissions); the code
          // is still selectable, so failing quietly is acceptable.
        }
      }}
      aria-label={copied ? "Copied" : "Copy code"}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-healthy" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Pre({ code, lang }: { code: string; lang: string }) {
  return (
    <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.78125rem] leading-[1.75] text-foreground">
      <code>
        {code.split("\n").map((line, i) => (
          <span key={i} className="block">
            <Line text={line} lang={lang} />
          </span>
        ))}
      </code>
    </pre>
  );
}

export function CodeBlock({
  code,
  lang = "ts",
  title,
}: {
  code: string;
  lang?: string;
  title?: string;
}) {
  const value = code.replace(/^\n+|\n+$/g, "");
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-elevated/50 px-3 py-1.5">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
          {title ?? lang}
        </span>
        <span className="ml-auto">
          <CopyButton value={value} />
        </span>
      </div>
      <Pre code={value} lang={lang} />
    </div>
  );
}

/** The same operation in several forms, one visible at a time. */
export function CodeTabs({
  tabs,
}: {
  tabs: Array<{ label: string; lang: string; code: string }>;
}) {
  const [active, setActive] = useState(0);
  const current = tabs[active] ?? tabs[0]!;
  const value = current.code.replace(/^\n+|\n+$/g, "");
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
      <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-border bg-elevated/50 px-2 py-1.5">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[0.75rem] transition-colors",
              i === active ? "bg-brand/12 text-brand-text" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto">
          <CopyButton value={value} />
        </span>
      </div>
      <Pre code={value} lang={current.lang} />
    </div>
  );
}

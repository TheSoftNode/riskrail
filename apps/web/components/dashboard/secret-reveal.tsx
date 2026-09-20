"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shown once, immediately after a key or signing secret is issued. The server
 * only keeps a hash (keys) or ciphertext (webhook secrets), so if the user
 * navigates away without copying this, it genuinely cannot be recovered.
 */
export function SecretReveal({
  label,
  value,
  onDismiss,
}: {
  label: string;
  value: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the value is selectable on screen */
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-warning/30 bg-warning/[0.07] p-4">
      <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-warning">
        <TriangleAlert className="size-3.5 shrink-0" />
        {label} — copy it now, it is not shown again
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-[0.75rem] break-all">
          {value}
        </code>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </div>
  );
}

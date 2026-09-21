import type { ReactNode } from "react";
import { DocsPager } from "@/components/docs/docs-pager";
import { DocsShell } from "@/components/docs/docs-shell";
import { DocsToc } from "@/components/docs/docs-toc";

export const metadata = {
  title: { default: "Documentation", template: "%s · Rivisk docs" },
  description:
    "Integrate Rivisk: the REST API, the TypeScript SDK, signed webhooks, realtime events and the Clarity risk registry on Stacks.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsShell>
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-12">
        <article className="min-w-0 max-w-3xl py-10 lg:py-12">
          {children}
          <DocsPager />
        </article>
        <aside className="hidden xl:block">
          <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto py-12">
            <DocsToc />
          </div>
        </aside>
      </div>
    </DocsShell>
  );
}

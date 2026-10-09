"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui";
import { publicFormPath } from "@/lib/share";
import type { Form } from "@/lib/types";
import { FormTabs } from "@/components/builder/FormTabs";

/** Same sections as the builder's top bar, with Results selected. */
export function ResultsHeader({ form, onShare }: { form: Form; onShare: () => void }) {
  const published = form.status === "published";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg px-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href="/forms"
          aria-label="Back to workspace"
          title="Back to workspace"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-bg-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="truncate px-2 text-sm font-semibold text-text">{form.title}</h1>
        <Badge variant={published ? "success" : "neutral"}>{published ? "Published" : "Draft"}</Badge>
      </div>

      <FormTabs active="results" formId={form.id} />

      <div className="flex shrink-0 items-center justify-end gap-2 md:flex-1">
        {published && (
          <a
            href={publicFormPath(form.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-input px-3 text-sm font-medium text-text-muted hover:bg-bg-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="hidden sm:inline">View form</span>
          </a>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

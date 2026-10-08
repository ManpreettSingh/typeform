"use client";

import { clsx } from "clsx";
import { ChevronRight, Link2, PanelsTopLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { ShareFormModal } from "@/components/dashboard/ShareFormModal";
import { useCopyLink } from "@/components/dashboard/useCopyLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, ConfirmDialog, IconButton } from "@/components/ui";
import { useSetPublished } from "@/lib/queries/forms";
import { useBuilderStore } from "@/store/builderStore";
import { SaveIndicator } from "./SaveIndicator";

/** Builder pages under the top tabs: Content (the builder), Workflow (logic), Connect (integrations). */
export type BuilderView = "content" | "workflow" | "connect";
type Tab = BuilderView | "share" | "results";

const TABS: { value: Tab; label: string }[] = [
  { value: "content", label: "Content" },
  { value: "workflow", label: "Workflow" },
  { value: "connect", label: "Connect" },
  { value: "share", label: "Share" },
  { value: "results", label: "Results" },
];

type Props = {
  view: BuilderView;
  onViewChange: (view: BuilderView) => void;
};

/** Typeform's builder header: breadcrumb with the form title, centered section tabs, save status and Publish. */
export function BuilderTopBar({ view, onViewChange }: Props) {
  const router = useRouter();
  const form = useBuilderStore((s) => s.form)!;
  const setTitle = useBuilderStore((s) => s.setTitle);
  const commitTitle = useBuilderStore((s) => s.commitTitle);
  const flush = useBuilderStore((s) => s.flush);
  const applyServerForm = useBuilderStore((s) => s.applyServerForm);
  const setPublished = useSetPublished();
  const copyLink = useCopyLink();
  const [dialog, setDialog] = useState<"share" | "publish-to-share" | null>(null);

  // Next's <Activity> keeps this mounted while hidden; don't come back to an open dialog.
  useLayoutEffect(() => () => setDialog(null), []);

  const published = form.status === "published";

  async function changePublished(next: boolean) {
    await flush(); // publish exactly what the creator sees
    setPublished.mutate(
      { id: form.id, published: next },
      {
        onSuccess: (updated) => {
          applyServerForm(updated);
          if (next) setDialog("share");
        },
      },
    );
  }

  function onTab(tab: Tab) {
    if (tab === "results") router.push(`/forms/${form.id}/results`);
    else if (tab === "share") setDialog(published ? "share" : "publish-to-share");
    else onViewChange(tab);
  }

  return (
    <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-bg px-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-text-muted">
        <Link
          href="/forms"
          aria-label="Forms (back to workspace)"
          className="flex shrink-0 items-center gap-1.5 rounded-input px-1 py-1 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <PanelsTopLeft className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Forms</span>
        </Link>
        <ChevronRight className="size-4 shrink-0" aria-hidden />
        <input
          aria-label="Form title"
          value={form.title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={
            "h-8 max-w-72 min-w-16 truncate rounded-input border border-transparent bg-transparent px-1.5 text-sm text-text-soft " +
            "[field-sizing:content] hover:border-border-strong focus:border-text-muted focus:outline-none"
          }
        />
      </nav>

      <div role="tablist" aria-label="Form sections" className="hidden h-full items-stretch gap-7 md:flex">
        {TABS.map(({ value, label }) => {
          const selected = value === view;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTab(value)}
              className={clsx(
                // Typeform marks the current section with a bar along the top edge.
                "relative px-0.5 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                selected
                  ? "text-text before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-b-[3px] before:bg-text-soft"
                  : "text-text-soft hover:text-text",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <SaveIndicator />
        {published && (
          <IconButton
            label="Copy public link"
            icon={<Link2 className="size-4" />}
            onClick={() => copyLink(form.slug)}
            className="border border-border-strong bg-field"
          />
        )}
        <Button
          size="sm"
          variant={published ? "secondary" : "primary"}
          loading={setPublished.isPending}
          onClick={() => changePublished(!published)}
        >
          {published ? "Unpublish" : "Publish"}
        </Button>
        <ThemeToggle />
      </div>

      <ShareFormModal form={dialog === "share" ? form : null} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === "publish-to-share"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          void changePublished(true);
        }}
        title="Publish to share"
        message="This form is a draft. Publish it to get a public link anyone can fill in."
        confirmLabel="Publish"
      />
    </header>
  );
}

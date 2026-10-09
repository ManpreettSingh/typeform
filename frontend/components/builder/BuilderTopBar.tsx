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
import { FormTabs } from "./FormTabs";

/** Builder pages under the top tabs: Content (the builder), Workflow (logic), Connect (integrations). */
export type BuilderView = "content" | "workflow" | "connect";
type Tab = BuilderView | "share" | "results";



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
          if (next) {
            import("canvas-confetti").then((confetti) => {
              confetti.default({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#000000", "#ffffff", "#4c414e"]
              });
            });
            setDialog("share");
          }
        },
      },
    );
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

      <FormTabs active={view} formId={form.id} onViewChange={onViewChange} />

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

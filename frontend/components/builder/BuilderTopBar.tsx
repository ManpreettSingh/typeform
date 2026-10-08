"use client";

import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { ShareFormModal } from "@/components/dashboard/ShareFormModal";
import { Badge, Button, ConfirmDialog, Tabs } from "@/components/ui";
import { useSetPublished } from "@/lib/queries/forms";
import { useBuilderStore } from "@/store/builderStore";
import { SaveIndicator } from "./SaveIndicator";

export type BuilderView = "create" | "settings";
type Tab = BuilderView | "results" | "share";

const TABS = [
  { value: "create" as const, label: "Create" },
  { value: "settings" as const, label: "Settings" },
  { value: "results" as const, label: "Results" },
  { value: "share" as const, label: "Share" },
];

type Props = {
  view: BuilderView;
  onViewChange: (view: BuilderView) => void;
  onPreview: () => void;
};

export function BuilderTopBar({ view, onViewChange, onPreview }: Props) {
  const router = useRouter();
  const form = useBuilderStore((s) => s.form)!;
  const setTitle = useBuilderStore((s) => s.setTitle);
  const commitTitle = useBuilderStore((s) => s.commitTitle);
  const flush = useBuilderStore((s) => s.flush);
  const applyServerForm = useBuilderStore((s) => s.applyServerForm);
  const setPublished = useSetPublished();
  const [dialog, setDialog] = useState<"share" | "publish-to-share" | null>(null);

  // Next's <Activity> keeps this mounted while hidden; don't come back to an open dialog.
  useLayoutEffect(() => () => setDialog(null), []);

  const published = form.status === "published";
  const hasQuestions = useBuilderStore((s) => s.questions.length > 0);

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
    if (tab === "create" || tab === "settings") onViewChange(tab);
    if (tab === "results") router.push(`/forms/${form.id}/results`);
    if (tab === "share") setDialog(published ? "share" : "publish-to-share");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg px-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href="/forms"
          aria-label="Back to workspace"
          title="Back to workspace"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-bg-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <input
          aria-label="Form title"
          value={form.title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={
            "h-8 max-w-80 min-w-24 truncate rounded-input border border-transparent bg-transparent px-2 text-sm font-semibold text-text " +
            "[field-sizing:content] hover:border-border focus:border-accent focus:ring-2 focus:ring-accent-soft focus:outline-none"
          }
        />
        <Badge variant={published ? "success" : "neutral"}>{published ? "Published" : "Draft"}</Badge>
      </div>

      <Tabs<Tab> aria-label="Form sections" items={TABS} value={view} onChange={onTab} className="hidden md:flex" />

      <div className="flex flex-1 items-center justify-end gap-3">
        <SaveIndicator />
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Eye className="size-4" aria-hidden />}
          disabled={!hasQuestions}
          title={hasQuestions ? "Try the form as a respondent" : "Add a question to preview"}
          onClick={onPreview}
        >
          <span className="hidden sm:inline">Preview</span>
        </Button>
        <Button
          size="sm"
          variant={published ? "secondary" : "primary"}
          loading={setPublished.isPending}
          onClick={() => changePublished(!published)}
        >
          {published ? "Unpublish" : "Publish"}
        </Button>
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

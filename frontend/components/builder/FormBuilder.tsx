"use client";

import { clsx } from "clsx";
import { AlertTriangle, ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { Button, ConfirmDialog, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { pluralize } from "@/lib/format";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { BuilderTopBar, type BuilderView } from "./BuilderTopBar";
import { FormSettingsView } from "./form-settings/FormSettingsView";
import { PreviewOverlay } from "./PreviewOverlay";
import { QuestionList } from "./QuestionList";
import { QuestionPreview } from "./QuestionPreview";
import { QuestionSettings } from "./QuestionSettings";

type MobilePane = "list" | "edit";

export function FormBuilder() {
  const { id } = useParams<{ id: string }>();
  const formId = Number(id);
  const load = useBuilderStore((s) => s.load);
  const loadForm = useBuilderStore((s) => s.loadForm);
  const loadedId = useBuilderStore((s) => s.form?.id);

  // Runs on mount and whenever Next's <Activity> re-shows this route: always start from fresh server data,
  // and send any pending edits when the route is hidden.
  useEffect(() => {
    if (!Number.isInteger(formId)) return;
    void loadForm(formId);
    return () => void useBuilderStore.getState().flush();
  }, [formId, loadForm]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const { hasUnsavedChanges, flush } = useBuilderStore.getState();
      if (!hasUnsavedChanges()) return;
      void flush();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (!Number.isInteger(formId) || load.error?.status === 404) {
    return (
      <FullScreenMessage
        icon={<FileQuestion className="size-6" />}
        title="Form not found"
        description="It may have been deleted."
      />
    );
  }
  if (load.status === "error") {
    return (
      <FullScreenMessage
        tone="danger"
        icon={<AlertTriangle className="size-6" />}
        title="Couldn't load this form"
        description={load.error?.message}
        action={
          <Button variant="secondary" onClick={() => loadForm(formId)}>
            Try again
          </Button>
        }
      />
    );
  }
  // The store may still hold a previously opened form until the effect above runs.
  if (load.status !== "ready" || loadedId !== formId) return <BuilderSkeleton />;

  return <BuilderLayout />;
}

function BuilderLayout() {
  const deleteQuestion = useBuilderStore((s) => s.deleteQuestion);
  const select = useBuilderStore((s) => s.select);
  const responseCount = useBuilderStore((s) => s.form?.response_count ?? 0);
  const [confirming, setConfirming] = useState<Question | null>(null);
  const [view, setView] = useState<BuilderView>("create");
  const [previewing, setPreviewing] = useState(false);
  const title = useBuilderStore((s) => s.form?.title);
  // Below md the panes don't fit side by side: one at a time, switched from a bar under the top bar.
  const [pane, setPane] = useState<MobilePane>("list");
  const selectedId = useBuilderStore((s) => s.selectedId);
  const [lastSelectedId, setLastSelectedId] = useState(selectedId);
  if (selectedId !== lastSelectedId) {
    // Picking (or adding) a question on a phone opens its settings.
    setLastSelectedId(selectedId);
    if (selectedId !== null) setPane("edit");
  }

  // Next's <Activity> keeps this mounted while hidden; don't return to an open preview or dialog.
  useLayoutEffect(
    () => () => {
      setPreviewing(false);
      setConfirming(null);
    },
    [],
  );

  // Deleting a question also deletes its answers, so only ask when there are responses to lose.
  const requestDelete = (question: Question) =>
    responseCount > 0 ? setConfirming(question) : void deleteQuestion(question.id);

  return (
    <div className="flex h-dvh flex-col">
      <title>{`${title?.trim() || "Untitled form"} · Edit · Forms`}</title>
      <BuilderTopBar view={view} onViewChange={setView} onPreview={() => setPreviewing(true)} />
      <Tabs<MobilePane | "settings">
        aria-label="Builder panes"
        className="shrink-0 border-b border-border px-2 py-1.5 md:hidden"
        items={[
          { value: "list", label: "Questions" },
          { value: "edit", label: "Edit question" },
          { value: "settings", label: "Settings" },
        ]}
        value={view === "settings" ? "settings" : pane}
        onChange={(value) => {
          if (value === "settings") return setView("settings");
          setView("create");
          setPane(value);
        }}
      />
      {view === "settings" ? (
        <FormSettingsView
          onEditQuestion={(id) => {
            select(id);
            setView("create");
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside
            aria-label="Questions"
            className={clsx(
              "min-h-0 flex-1 overflow-y-auto md:w-64 md:flex-none md:border-r md:border-border lg:w-72",
              pane !== "list" && "hidden md:block",
            )}
          >
            <QuestionList onDelete={requestDelete} />
          </aside>
          <section aria-label="Preview" className="hidden min-w-0 flex-1 bg-bg-subtle lg:flex">
            <QuestionPreview />
          </section>
          <aside
            aria-label="Question settings"
            className={clsx(
              "min-h-0 flex-1 overflow-y-auto md:w-80 md:flex-none md:border-l md:border-border",
              pane !== "edit" && "hidden md:block",
            )}
          >
            <QuestionSettings onDelete={requestDelete} />
          </aside>
        </div>
      )}
      {previewing && <PreviewOverlay onClose={() => setPreviewing(false)} />}

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) void deleteQuestion(confirming.id);
          setConfirming(null);
        }}
        title="Delete this question?"
        message={`This form has ${pluralize(responseCount, "response")}. Answers to this question will be deleted too.`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

export function BuilderSkeleton() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-label="Loading form">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <Skeleton className="size-8" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="flex flex-1">
        <div className="flex flex-1 flex-col gap-3 p-4 md:w-72 md:flex-none md:border-r md:border-border">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <div className="hidden flex-1 bg-bg-subtle lg:block" />
        <div className="hidden w-80 flex-col gap-4 border-l border-border p-5 md:flex">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
        </div>
      </div>
    </div>
  );
}

function FullScreenMessage(props: React.ComponentProps<typeof EmptyState>) {
  return (
    <main className="flex flex-1 items-center justify-center">
      <EmptyState
        {...props}
        action={
          <div className="flex items-center gap-3">
            {props.action}
            <Link
              href="/forms"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden /> Back to workspace
            </Link>
          </div>
        }
      />
    </main>
  );
}

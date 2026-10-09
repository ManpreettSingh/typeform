"use client";

import { clsx } from "clsx";
import {
  AlertTriangle,
  ArrowLeft,
  FileQuestion,
  Flag,
  Monitor,
  PanelRight,
  Palette,
  Play,
  Plus,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { ChatToCreateBar } from "@/components/ai/ChatToCreateBar";
import { Button, ConfirmDialog, EmptyState, IconButton, Skeleton, Tabs } from "@/components/ui";
import { pluralize } from "@/lib/format";
import type { Form, Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { AddContentModal } from "./AddContentModal";
import { BuilderTopBar, type BuilderView } from "./BuilderTopBar";
import { BuilderCanvas, type CanvasDevice } from "./canvas/BuilderCanvas";
import { ComingSoonSection } from "./form-settings/ComingSoonSection";
import { ThemeSettings } from "./form-settings/ThemeSettings";
import { WelcomeSettings } from "./form-settings/WelcomeSettings";
import { EndingSettings } from "./form-settings/EndingSettings";
import { LogicOverview } from "./logic/LogicOverview";
import { PreviewOverlay } from "./PreviewOverlay";
import { QuestionList } from "./QuestionList";
import { QuestionSettings } from "./QuestionSettings";

type MobilePane = "pages" | "canvas" | "settings";

const VIEWS: readonly BuilderView[] = ["content", "workflow", "connect"];

/**
 * Content / Workflow / Connect, kept in the URL (`?view=connect`). Next's <Activity> keeps this page alive while
 * Results or Share is shown, so a view held in state came back stale: clicking Content there showed Connect. The URL
 * says which tab was clicked; switching inside the builder updates it without a server round trip.
 */
function useBuilderView(): [BuilderView, (view: BuilderView) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = params.get("view");
  const view = VIEWS.find((v) => v === raw) ?? "content";
  const setView = useCallback(
    (next: BuilderView) => window.history.replaceState(null, "", next === "content" ? pathname : `${pathname}?view=${next}`),
    [pathname],
  );
  return [view, setView];
}

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
  const title = useBuilderStore((s) => s.form?.title);
  const screen = useBuilderStore((s) => s.screen);
  const selectedId = useBuilderStore((s) => s.selectedId);
  const hasQuestions = useBuilderStore((s) => s.questions.length > 0);
  const [confirming, setConfirming] = useState<Question | null>(null);
  const [view, setView] = useBuilderView();
  const [previewing, setPreviewing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [design, setDesign] = useState(false);
  // Typeform AI's review view; the string is the prompt that opened it.
  const [ai, setAi] = useState<string | null>(null);
  const loadForm = useBuilderStore((s) => s.loadForm);
  const formTheme = useBuilderStore((s) => s.form?.theme);
  const currentFormId = useBuilderStore((s) => s.form?.id ?? null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [device, setDevice] = useState<CanvasDevice>("desktop");
  // Below lg the three columns don't fit: one at a time, switched from a bar under the top bar.
  const [pane, setPane] = useState<MobilePane>("pages");
  const [lastPick, setLastPick] = useState(`${screen}:${selectedId}`);
  if (`${screen}:${selectedId}` !== lastPick) {
    // Picking (or adding) something on a small screen shows it on the canvas.
    setLastPick(`${screen}:${selectedId}`);
    setPane("canvas");
    setDesign(false);
  }

  // Next's <Activity> keeps this mounted while hidden; don't return to an open preview or dialog.
  useLayoutEffect(
    () => () => {
      setPreviewing(false);
      setConfirming(null);
      setAdding(false);
      setAi(null);
    },
    [],
  );

  // The AI reads the saved form, so send any pending edits first.
  const openAi = async (prompt: string) => {
    await useBuilderStore.getState().flush();
    setAi(prompt);
  };
  const onAiApplied = async (applied: Form) => {
    setAi(null);
    await loadForm(applied.id);
    toast.success("Changes applied to your form");
  };

  // Deleting a question also deletes its answers, so only ask when there are responses to lose.
  const requestDelete = (question: Question) =>
    responseCount > 0 ? setConfirming(question) : void deleteQuestion(question.id);

  let panel: React.ReactNode;
  if (design) panel = <ThemeSettings />;
  else if (screen === "welcome") panel = <WelcomeSettings />;
  else if (screen === "ending") panel = <EndingSettings />;
  else panel = <QuestionSettings onDelete={requestDelete} />;

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <title>{`${title?.trim() || "Untitled form"} · Edit · Forms`}</title>
      <BuilderTopBar view={view} onViewChange={setView} />
      {view === "content" && (
        <Tabs<MobilePane>
          aria-label="Builder panes"
          className="shrink-0 border-b border-border px-2 py-1.5 lg:hidden"
          items={[
            { value: "pages", label: "Pages" },
            { value: "canvas", label: "Canvas" },
            { value: "settings", label: "Settings" },
          ]}
          value={pane}
          onChange={setPane}
        />
      )}

      {view === "content" ? (
        <div className="flex min-h-0 flex-1 gap-4 px-3 pt-1 pb-3">
          <div
            className={clsx(
              "min-h-0 w-full flex-col gap-4 lg:flex lg:w-64 lg:shrink-0",
              pane === "pages" ? "flex" : "hidden",
            )}
          >
            <aside aria-label="Pages" className="min-h-0 flex-1 overflow-y-auto rounded-card bg-bg-subtle">
              <QuestionList onDelete={requestDelete} onAddContent={() => setAdding(true)} />
            </aside>
            <EndingsCard />
          </div>

          <section
            aria-label="Canvas"
            className={clsx("relative min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex", pane === "canvas" ? "flex" : "hidden")}
          >
            <div className="flex h-12 shrink-0 items-center gap-1.5 rounded-card bg-bg-subtle px-2">
              <Button size="sm" leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
                Add content
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={design}
                className={design ? "bg-bg-hover text-text" : undefined}
                leftIcon={<Palette className="size-4" aria-hidden />}
                onClick={() => {
                  setDesign((d) => !d);
                  setPanelOpen(true);
                  setPane("settings");
                }}
              >
                Design
              </Button>
              <span aria-hidden className="mx-1 h-5 w-px bg-border-strong" />
              <IconButton
                label={device === "mobile" ? "Desktop view" : "Mobile view"}
                aria-pressed={device === "mobile"}
                icon={device === "mobile" ? <Monitor className="size-4" /> : <Smartphone className="size-4" />}
                onClick={() => setDevice((d) => (d === "mobile" ? "desktop" : "mobile"))}
              />
              <IconButton
                label="Preview"
                title={hasQuestions ? "Try the form as a respondent" : "Add a question to preview"}
                icon={<Play className="size-4" />}
                disabled={!hasQuestions}
                onClick={() => setPreviewing(true)}
              />
              <span className="flex-1" />
              <IconButton
                label={panelOpen ? "Hide settings panel" : "Show settings panel"}
                aria-pressed={panelOpen}
                icon={<PanelRight className="size-4" />}
                onClick={() => setPanelOpen((open) => !open)}
                className="max-lg:hidden"
              />
            </div>
            <BuilderCanvas device={device} onAskAi={(prompt) => void openAi(prompt)} onStartFromScratch={() => setAdding(true)} />
            {(hasQuestions || screen !== "question") && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                <ChatToCreateBar onSubmit={openAi} className="pointer-events-auto w-full max-w-[420px]" />
              </div>
            )}
          </section>

          {(panelOpen || pane === "settings") && (
            <aside
              aria-label={design ? "Design" : "Question settings"}
              className={clsx(
                "min-h-0 w-full flex-col gap-3 overflow-y-auto lg:flex lg:w-64 lg:shrink-0",
                pane === "settings" ? "flex" : "hidden",
                !panelOpen && "lg:hidden",
              )}
            >
              {panel}
            </aside>
          )}
        </div>
      ) : (
        <div className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-card bg-bg-subtle">
          {view === "workflow" ? (
            <LogicOverview
              onEditQuestion={(id) => {
                select(id);
                setView("content");
              }}
            />
          ) : (
            <div className="flex flex-col">
              <ComingSoonSection
                title="Integrations"
                description="Send responses to Google Sheets, Slack, webhooks and more."
              />
              <ComingSoonSection
                title="Collaborate"
                description="Invite teammates to build and review forms with you."
              />
            </div>
          )}
        </div>
      )}

      {previewing && <PreviewOverlay onClose={() => setPreviewing(false)} />}
      {ai !== null && (
        <AiAssistant formId={currentFormId} initialPrompt={ai} theme={formTheme} onClose={() => setAi(null)} onApplied={onAiApplied} />
      )}
      <AddContentModal open={adding} onClose={() => setAdding(false)} onAskAi={(prompt) => void openAi(prompt)} />

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

/** Typeform's "Endings" card under the pages: here, the one thank-you screen. */
function EndingsCard() {
  const screen = useBuilderStore((s) => s.screen);
  const showScreen = useBuilderStore((s) => s.showScreen);
  const ending = useBuilderStore((s) => s.form?.thank_you.title);
  return (
    <section aria-label="Endings" className="shrink-0 rounded-card bg-bg-subtle p-3">
      <div className="flex items-center justify-between px-2 pb-2">
        <h2 className="text-sm font-semibold text-text">Endings</h2>
        <IconButton
          size="sm"
          label="Add ending (coming soon)"
          icon={<Plus className="size-4" />}
          disabled
          className="border border-border-strong bg-field"
        />
      </div>
      <button
        type="button"
        onClick={() => showScreen("ending")}
        aria-current={screen === "ending" ? "true" : undefined}
        className={clsx(
          "flex w-full items-center gap-2.5 rounded-field p-2 text-left text-sm text-text-soft focus-visible:outline-2 focus-visible:outline-accent",
          screen === "ending" ? "bg-bg-hover" : "hover:bg-bg-hover/60",
        )}
      >
        <span className="flex h-6 items-center rounded-input bg-qt-screen px-1.5 text-qt-fg">
          <Flag className="size-3.5" aria-hidden />
        </span>
        <span className="truncate">{ending || "Thank-you screen"}</span>
      </button>
    </section>
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

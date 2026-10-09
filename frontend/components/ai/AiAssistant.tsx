"use client";

import { clsx } from "clsx";
import { Brain, ChevronLeft, ChevronRight, MoreHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button, ConfirmDialog, IconButton, Menu, Tabs } from "@/components/ui";
import { getErrorMessage } from "@/lib/api";
import { currentVersion, hasChanges, initialSession, messagesForServer, sessionReducer } from "@/lib/ai/session";
import { aiChatApi } from "@/lib/queries/aiChat";
import { DEFAULT_THEME } from "@/lib/theme";
import type { Form, Theme } from "@/lib/types";
import { AiMemoryDialog } from "./AiMemoryDialog";
import { ChatThread } from "./ChatThread";
import { ProposalPreview } from "./ProposalPreview";
import { SuggestedChanges } from "./SuggestedChanges";

const noopSubscribe = () => () => {};

type ReviewTab = "changes" | "preview";
type MobilePane = "chat" | "review";

export type AiAssistantProps = {
  /** The form being edited, or null when the AI drafts a brand-new form (Apply creates it). */
  formId: number | null;
  /** Sent as the first message as soon as the view opens. */
  initialPrompt: string;
  /** The form's theme for the preview (an existing form); new forms use the default theme. */
  theme?: Theme;
  onClose: () => void;
  /** Called with the saved form after Apply succeeded. The caller closes the view. */
  onApplied: (form: Form) => void;
};

/**
 * Typeform AI's review view: the conversation on the left, "Suggested changes | Preview" on the right and
 * "Apply changes to form" at the bottom. Nothing touches the form until Apply.
 */
export function AiAssistant({ formId, initialPrompt, theme = DEFAULT_THEME, onClose, onApplied }: AiAssistantProps) {
  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  const [tab, setTab] = useState<ReviewTab>("changes");
  const [pane, setPane] = useState<MobilePane>("chat");
  const [confirmClose, setConfirmClose] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const version = currentVersion(session);
  const changes = hasChanges(session);

  // The opening prompt goes out once (the ref survives StrictMode's second mount).
  const sentInitial = useRef(false);
  useEffect(() => {
    if (sentInitial.current || !initialPrompt.trim()) return;
    sentInitial.current = true;
    dispatch({ type: "send", text: initialPrompt });
  }, [initialPrompt]);

  // One request per "thinking" state; leaving the view (or sending again) aborts the one in flight.
  const { status, messages } = session;
  const draft = version?.proposal ?? null;
  useEffect(() => {
    if (status !== "thinking") return;
    const controller = new AbortController();
    aiChatApi
      .chat({ form_id: formId, messages: messagesForServer(messages), draft }, controller.signal)
      .then((out) => {
        dispatch({ type: "reply", out });
        // A new proposal is worth looking at: bring the review list forward.
        if (out.proposal) setTab("changes");
      })
      .catch((e) => {
        if (!controller.signal.aborted) dispatch({ type: "fail", message: getErrorMessage(e) });
      });
    return () => controller.abort();
  }, [status, messages, draft, formId]);

  const dialogOpen = confirmClose || memoryOpen;
  const requestClose = () => (changes ? setConfirmClose(true) : onClose());
  const closeRef = useRef(requestClose);
  const dialogOpenRef = useRef(dialogOpen);
  useEffect(() => {
    closeRef.current = requestClose;
    dialogOpenRef.current = dialogOpen;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !dialogOpenRef.current) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, []);

  async function apply() {
    if (!version || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      const form = await aiChatApi.apply({ form_id: formId, proposal: version.proposal });
      onApplied(form);
    } catch (e) {
      setApplyError(getErrorMessage(e));
      setApplying(false);
    }
  }

  if (!mounted) return null;

  const actionBar = (
    <div className="flex items-center justify-end gap-3 rounded-card border border-border bg-bg px-4 py-2.5 shadow-lg">
      {applyError ? (
        <p role="alert" className="mr-auto text-sm text-danger">
          {applyError}
        </p>
      ) : (
        !changes && <p className="mr-auto text-sm text-text-muted">{version ? "No changes to apply." : "Suggested changes appear here."}</p>
      )}
      <Button onClick={apply} loading={applying} disabled={!changes}>
        {formId === null ? "Create form" : "Apply changes to form"}
      </Button>
    </div>
  );

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Typeform AI" className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="flex size-7 items-center justify-center rounded-full border border-ai-line bg-ai-halo text-text-muted">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <h2 className="text-base font-medium text-text">Typeform AI</h2>
        <span className="flex-1" />
        <Tabs<MobilePane>
          aria-label="Panes"
          className="lg:hidden"
          items={[
            { value: "chat", label: "Chat" },
            { value: "review", label: "Review" },
          ]}
          value={pane}
          onChange={setPane}
        />
        <Menu
          trigger={(props) => <IconButton label="More options" icon={<MoreHorizontal className="size-4" />} {...props} />}
          items={[{ label: "Memory", icon: <Brain className="size-4" aria-hidden />, onSelect: () => setMemoryOpen(true) }]}
        />
        <IconButton label="Close" icon={<X className="size-4" />} onClick={requestClose} />
      </header>

      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Conversation"
          className={clsx(
            "min-h-0 w-full flex-col border-border lg:flex lg:w-[400px] lg:shrink-0 lg:border-r",
            pane === "chat" ? "flex" : "hidden",
          )}
        >
          <ChatThread
            session={session}
            onSend={(text) => dispatch({ type: "send", text })}
            onRetry={() => dispatch({ type: "retry" })}
            onRestore={(index) => dispatch({ type: "restore", index })}
          />
        </section>

        <section
          aria-label="Review"
          className={clsx("relative min-h-0 min-w-0 flex-1 flex-col bg-bg-subtle lg:flex", pane === "review" ? "flex" : "hidden")}
        >
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            <Tabs<ReviewTab>
              aria-label="Review"
              items={[
                { value: "changes", label: "Suggested changes" },
                { value: "preview", label: "Preview", disabled: !version },
              ]}
              value={tab}
              onChange={setTab}
            />
            {session.versions.length > 1 && (
              <div className="flex items-center gap-1 text-xs text-text-muted" role="group" aria-label="Versions">
                <IconButton
                  size="sm"
                  label="Previous version"
                  icon={<ChevronLeft className="size-4" />}
                  disabled={session.current <= 0}
                  onClick={() => dispatch({ type: "restore", index: session.current - 1 })}
                />
                <span aria-live="polite" className="tabular-nums">
                  Version {session.current + 1} of {session.versions.length}
                </span>
                <IconButton
                  size="sm"
                  label="Next version"
                  icon={<ChevronRight className="size-4" />}
                  disabled={session.current >= session.versions.length - 1}
                  onClick={() => dispatch({ type: "restore", index: session.current + 1 })}
                />
              </div>
            )}
          </div>

          {tab === "preview" && version ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ProposalPreview proposal={version.proposal} theme={theme} versionKey={session.current} />
              </div>
              {/* The preview fills the pane, so the button floats over its bottom edge. */}
              <div className="absolute inset-x-0 bottom-6 z-10 mx-auto w-fit max-w-[calc(100%-2rem)]">{actionBar}</div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="flex flex-col">
                <SuggestedChanges diff={version?.diff ?? null} versionKey={session.current} />
              </div>
              {/* Right under the last suggestion; once the list is long it stays just above the bottom edge. */}
              <div className="sticky bottom-6 z-10 mx-auto mb-6 w-fit max-w-[calc(100%-2rem)]">{actionBar}</div>
            </div>
          )}

        </section>
      </div>

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        title="Discard these suggestions?"
        message="The changes Typeform AI suggested haven't been applied to your form. They'll be lost if you close this."
        confirmLabel="Discard"
        destructive
      />
      <AiMemoryDialog open={memoryOpen} onClose={() => setMemoryOpen(false)} />
    </div>,
    document.body,
  );
}

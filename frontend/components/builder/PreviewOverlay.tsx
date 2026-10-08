"use client";

import { RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RespondentFlow } from "@/components/respondent/RespondentFlow";
import { RespondentTheme } from "@/components/respondent/RespondentTheme";
import { Badge, Button, IconButton } from "@/components/ui";
import { useBuilderStore } from "@/store/builderStore";

const noopSubscribe = () => () => {};

/** Full-screen, non-persisting run of the form exactly as respondents will see it. */
export function PreviewOverlay({ onClose }: { onClose: () => void }) {
  const form = useBuilderStore((s) => s.form!);
  const questions = useBuilderStore((s) => s.questions);
  const [run, setRun] = useState(0);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Form preview" className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-2 text-sm text-text">
          <Badge variant="accent">Preview</Badge>
          <span className="hidden truncate sm:inline">Answers here aren&rsquo;t saved.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RotateCcw className="size-4" aria-hidden />}
            onClick={() => setRun((r) => r + 1)}
          >
            Restart
          </Button>
          <IconButton label="Close preview" icon={<X className="size-4" />} onClick={onClose} />
        </div>
      </div>
      <RespondentTheme theme={form.theme} className="min-h-0 flex-1">
        {/* Keyed by run: Restart starts a fresh flow. */}
        <RespondentFlow key={run} questions={questions} thankYou={form.thank_you} />
      </RespondentTheme>
    </div>,
    document.body,
  );
}

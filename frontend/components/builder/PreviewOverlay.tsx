"use client";

import { clsx } from "clsx";
import { Monitor, Smartphone, RotateCcw, X } from "lucide-react";
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
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
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

  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  if (!mounted) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Form preview" className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-2 text-sm text-text">
          <Badge variant="accent">Preview</Badge>
          <span className="hidden truncate sm:inline">Answers here aren&rsquo;t saved.</span>
        </div>
        
        <div className="flex items-center rounded-md border border-border p-0.5">
          <IconButton
            label="Desktop view"
            aria-pressed={device === "desktop"}
            icon={<Monitor className="size-4" />}
            onClick={() => setDevice("desktop")}
            className={device === "desktop" ? "bg-bg-muted" : ""}
          />
          <IconButton
            label="Mobile view"
            aria-pressed={device === "mobile"}
            icon={<Smartphone className="size-4" />}
            onClick={() => setDevice("mobile")}
            className={device === "mobile" ? "bg-bg-muted" : ""}
          />
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
      <div className="flex-1 bg-bg-muted overflow-hidden flex flex-col items-center justify-center p-4">
        <div className={clsx(
          "w-full h-full overflow-hidden bg-bg shadow-sm transition-all duration-300",
          device === "mobile" ? "max-w-[375px] max-h-[812px] rounded-[2rem] ring-8 ring-black/20" : "rounded-lg ring-1 ring-border"
        )}>
          <RespondentTheme theme={form.theme} className="h-full flex flex-col">
            {/* Keyed by run: Restart starts a fresh flow. */}
            <RespondentFlow
              key={run}
              questions={questions}
              thankYou={form.thank_you}
              // Same rule as the public page: a description turns the welcome screen on.
              welcome={form.description?.trim() ? { title: form.title, description: form.description.trim(), ...form.welcome, submission_count: form.response_count } : null}
              endings={form.endings}
            />
          </RespondentTheme>
        </div>
      </div>
    </div>,
    document.body,
  );
}

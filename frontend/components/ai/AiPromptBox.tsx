"use client";

import { clsx } from "clsx";
import { ArrowUp } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { nextTypewriterStep, TYPEWRITER_PHRASES, typewriterStart, type TypewriterState } from "@/lib/ai/typewriter";

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
};

/** The placeholder text, typed and deleted like Typeform's. Static when the person prefers reduced motion. */
function useTypewriter(active: boolean): string {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<TypewriterState>(typewriterStart);
  useEffect(() => {
    if (!active || reduced) return;
    const step = nextTypewriterStep(state, TYPEWRITER_PHRASES);
    const timer = setTimeout(() => setState(step.state), step.delay);
    return () => clearTimeout(timer);
  }, [state, active, reduced]);
  return reduced ? TYPEWRITER_PHRASES[0] : TYPEWRITER_PHRASES[state.phrase].slice(0, state.shown);
}

/**
 * Typeform's big AI prompt box ("What would you like to create?"): lilac halo, white inner box, typewriter placeholder,
 * round send button. Enter sends, Shift+Enter makes a new line.
 */
export function AiPromptBox({
  onSubmit,
  disabled = false,
  autoFocus = false,
  label = "Describe your form",
  className,
}: {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const placeholder = useTypewriter(text === "" && !disabled);
  const canSend = text.trim().length > 0 && !disabled;

  function send() {
    if (!canSend) return;
    onSubmit(text.trim());
    setText("");
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      className={clsx(
        "w-full max-w-[460px] rounded-xl bg-ai-halo p-2.5 transition-shadow duration-[600ms] ease-[cubic-bezier(.55,0,.1,1)]",
        focused ? "shadow-[0_0_0_3px_var(--ai-line)]" : "shadow-[0_0_0_3px_rgb(84_80_88/0.09)]",
        className,
      )}
    >
      <div className="flex h-[128px] flex-col rounded-md border border-ai-line bg-field p-3 shadow-[inset_0_0_0_1px_rgb(83_78_86/0.12)]">
        <textarea
          aria-label={label}
          value={text}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={4000}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="min-h-0 flex-1 resize-none bg-transparent text-sm leading-5 text-text placeholder:text-text-subtle focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={send}
            className={clsx(
              "inline-flex size-6 items-center justify-center rounded-full border transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              canSend
                ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover"
                : "border-border bg-bg-subtle text-text-subtle",
            )}
          >
            <ArrowUp className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

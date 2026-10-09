"use client";

import { clsx } from "clsx";
import { ArrowUp, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

/** Typeform's "Chat to create" bar under the builder canvas: one line, lilac halo, opens the AI review view on send. */
export function ChatToCreateBar({
  onSubmit,
  disabled = false,
  label = "Chat to create",
  className,
}: {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  /** Both the placeholder and the accessible name ("Ask Typeform AI" in the workspace). */
  label?: string;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const canSend = text.trim().length > 0 && !disabled;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <form
      onSubmit={submit}
      className={clsx(
        "rounded-full bg-ai-halo p-1 transition-shadow duration-[600ms] ease-[cubic-bezier(.55,0,.1,1)]",
        focused ? "shadow-[0_0_0_3px_var(--ai-line)]" : "shadow-[0_0_0_3px_rgb(84_80_88/0.09)]",
        className,
      )}
    >
      <div className="flex h-10 items-center gap-2 rounded-full border border-ai-line bg-field pr-1.5 pl-3.5">
        <Sparkles className="size-4 shrink-0 text-text-muted" aria-hidden />
        <input
          type="text"
          aria-label={label}
          placeholder={label}
          autoComplete="off"
          maxLength={4000}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className={clsx(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            canSend ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover" : "border-border bg-bg-subtle text-text-subtle",
          )}
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}

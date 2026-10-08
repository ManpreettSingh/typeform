"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { optionLetter } from "@/lib/questionTypes";
import { AUTO_ADVANCE_MS, type AnswerProps } from "../types";
import { useDelayedCall, useShortcutKeys } from "./useShortcutKeys";

export function ChoiceButton({
  keyLabel,
  selected,
  multi,
  onClick,
  children,
}: {
  keyLabel: string;
  selected: boolean;
  multi: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-input border px-3 py-2 text-left text-lg text-resp-accent transition-colors sm:text-xl",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent",
        selected
          ? "border-resp-accent bg-resp-accent/25"
          : "border-resp-accent/40 bg-resp-accent/10 hover:bg-resp-accent/20",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "flex size-6 shrink-0 items-center justify-center rounded-input border text-xs font-semibold",
          selected
            ? "border-resp-accent bg-resp-accent text-resp-accent-fg"
            : "border-resp-accent/50 bg-resp-bg text-resp-accent",
        )}
      >
        {keyLabel}
      </span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {selected && <Check className="size-5 shrink-0" aria-hidden />}
    </button>
  );
}

export function MultipleChoiceAnswer({
  question,
  value,
  onChange,
  onSubmit,
  live,
  autoAdvance,
  labelledBy,
}: AnswerProps<"multiple_choice">) {
  const { options, allow_multiple } = question.properties;
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const later = useDelayedCall();

  function pick(id: string) {
    if (allow_multiple) {
      const next = selected.has(id) ? [...selected].filter((x) => x !== id) : [...selected, id];
      // Keep the creator's option order regardless of click order.
      onChange(options.map((o) => o.id).filter((x) => next.includes(x)));
      return;
    }
    onChange(id);
    if (autoAdvance) later(onSubmit, AUTO_ADVANCE_MS);
  }

  useShortcutKeys(live, (key) => {
    const index = options.findIndex((_, i) => optionLetter(i) === key);
    if (index === -1) return false;
    pick(options[index].id);
    return true;
  });

  return (
    <div
      role={allow_multiple ? "group" : "radiogroup"}
      aria-labelledby={labelledBy}
      className="flex max-w-md flex-col gap-2"
    >
      {allow_multiple && <p className="mb-1 text-sm opacity-70">Choose as many as you like</p>}
      {options.map((o, i) => (
        <ChoiceButton
          key={o.id}
          keyLabel={optionLetter(i)}
          selected={selected.has(o.id)}
          multi={allow_multiple}
          onClick={() => pick(o.id)}
        >
          {o.label || <span className="opacity-60">Choice {i + 1}</span>}
        </ChoiceButton>
      ))}
    </div>
  );
}

export function YesNoAnswer({ value, onChange, onSubmit, live, autoAdvance, labelledBy }: AnswerProps<"yes_no">) {
  const later = useDelayedCall();

  function pick(answer: boolean) {
    onChange(answer);
    if (autoAdvance) later(onSubmit, AUTO_ADVANCE_MS);
  }

  useShortcutKeys(live, (key) => {
    if (key !== "Y" && key !== "N") return false;
    pick(key === "Y");
    return true;
  });

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex max-w-48 flex-col gap-2">
      <ChoiceButton keyLabel="Y" selected={value === true} multi={false} onClick={() => pick(true)}>
        Yes
      </ChoiceButton>
      <ChoiceButton keyLabel="N" selected={value === false} multi={false} onClick={() => pick(false)}>
        No
      </ChoiceButton>
    </div>
  );
}

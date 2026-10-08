"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { newOptionId, optionLetter } from "@/lib/questionTypes";
import type { ChoiceOption, QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

// Mirrors backend limits (schemas/properties.py).
const MIN_OPTIONS = 1;
const MAX_OPTIONS = 50;
const LABEL_MAX = 500;

/**
 * Multiple-choice options edited right on the canvas, like Typeform: type into a choice, Enter adds the next one,
 * Backspace on an empty one removes it, "Add choice" appends.
 */
export function CanvasChoices({ question }: { question: QuestionOf<"multiple_choice"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const { options, allow_multiple } = question.properties;
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // Option to focus once it has rendered (after an add/remove).
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingFocus.current) return;
    inputs.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  function setOptions(next: ChoiceOption[], debounceMs?: number) {
    updateQuestion(question.id, { properties: { ...question.properties, options: next } }, debounceMs);
  }

  function addAfter(index: number) {
    if (options.length >= MAX_OPTIONS) return;
    const option = { id: newOptionId(), label: "" };
    setOptions([...options.slice(0, index + 1), option, ...options.slice(index + 1)], 0);
    pendingFocus.current = option.id;
  }

  function remove(index: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(options.filter((_, i) => i !== index), 0);
    pendingFocus.current = (options[index - 1] ?? options[index + 1])?.id ?? null;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      addAfter(index);
    } else if (e.key === "Backspace" && options[index].label === "" && options.length > MIN_OPTIONS) {
      e.preventDefault();
      remove(index);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-2">
      {allow_multiple && <p className="mb-1 text-sm opacity-70">Choose as many as you like</p>}
      {options.map((option, i) => (
        <div
          key={option.id}
          className="group flex h-11 items-center gap-3 rounded-input border border-resp-accent/40 bg-resp-accent/10 pr-1 pl-3 text-lg text-resp-accent focus-within:border-resp-accent sm:text-xl"
        >
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-input border border-resp-accent/50 bg-resp-bg text-xs font-semibold"
          >
            {optionLetter(i)}
          </span>
          <input
            ref={(el) => {
              if (el) inputs.current.set(option.id, el);
              else inputs.current.delete(option.id);
            }}
            aria-label={`Choice ${optionLetter(i)}`}
            placeholder={`Choice ${i + 1}`}
            value={option.label}
            maxLength={LABEL_MAX}
            onChange={(e) => setOptions(options.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)))}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="min-w-0 flex-1 bg-transparent placeholder:italic placeholder:opacity-50 focus:outline-none"
          />
          <button
            type="button"
            aria-label={`Remove choice ${optionLetter(i)}`}
            disabled={options.length <= MIN_OPTIONS}
            onClick={() => remove(i)}
            className="flex size-7 shrink-0 items-center justify-center rounded-input opacity-0 group-focus-within:opacity-70 group-hover:opacity-70 hover:!opacity-100 focus-visible:opacity-100 disabled:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={options.length >= MAX_OPTIONS}
        onClick={() => addAfter(options.length - 1)}
        className="mt-1 self-start text-sm underline underline-offset-4 opacity-80 hover:opacity-100 disabled:opacity-40"
      >
        Add choice
      </button>
    </div>
  );
}

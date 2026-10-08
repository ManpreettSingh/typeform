"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button, IconButton } from "@/components/ui";
import { newOptionId, optionLetter } from "@/lib/questionTypes";
import type { ChoiceOption, QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { SwitchRow } from "../panel/PanelCard";

// Mirrors backend limits (schemas/properties.py).
const MIN_OPTIONS = 1;
const MAX_OPTIONS = { multiple_choice: 50, dropdown: 500 } as const;
const LABEL_MAX = 500;

type ChoiceQuestion = QuestionOf<"multiple_choice"> | QuestionOf<"dropdown">;

/**
 * Multiple choice: options are edited on the canvas, so the panel only has "Multiple selection".
 * Dropdown: the (possibly long) option list is edited here.
 */
export function ChoiceSettings({ question }: { question: ChoiceQuestion }) {
  if (question.type === "multiple_choice") return <MultipleChoiceSettings question={question} />;
  return <DropdownChoices question={question} />;
}

function MultipleChoiceSettings({ question }: { question: QuestionOf<"multiple_choice"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  return (
    <SwitchRow
      label="Multiple selection"
      checked={question.properties.allow_multiple}
      onChange={(allow_multiple) => updateQuestion(question.id, { properties: { ...question.properties, allow_multiple } }, 0)}
    />
  );
}

function DropdownChoices({ question }: { question: ChoiceQuestion }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const { options } = question.properties;
  const max = MAX_OPTIONS[question.type];
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
    if (options.length >= max) return;
    const option = { id: newOptionId(), label: "" };
    setOptions([...options.slice(0, index + 1), option, ...options.slice(index + 1)], 0);
    pendingFocus.current = option.id;
  }

  function remove(index: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(options.filter((_, i) => i !== index), 0);
    // Keep the keyboard flow going: focus the previous choice (or the next one when removing the first).
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
    <div className="flex flex-col gap-4 py-2">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-text-muted">Choices</legend>
        {options.map((option, i) => (
          <div key={option.id} className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-input border border-border-strong bg-field text-xs font-semibold text-text-soft">
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
              className="h-8 min-w-0 flex-1 rounded-field border border-border-strong bg-field px-2.5 text-sm text-text placeholder:text-text-muted focus:border-text-muted focus:outline-none"
            />
            <IconButton
              size="sm"
              label={`Remove choice ${optionLetter(i)}`}
              icon={<X className="size-4" />}
              disabled={options.length <= MIN_OPTIONS}
              onClick={() => remove(i)}
            />
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          leftIcon={<Plus className="size-4" aria-hidden />}
          disabled={options.length >= max}
          onClick={() => addAfter(options.length - 1)}
        >
          Add choice
        </Button>
        <p className="text-xs text-text-muted">Press Enter to add another choice.</p>
      </fieldset>

    </div>
  );
}

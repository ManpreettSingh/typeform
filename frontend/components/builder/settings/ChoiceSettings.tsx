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
  if (question.type === "multiple_choice") return <MultipleChoiceSettings question={question as QuestionOf<"multiple_choice">} />;
  return <DropdownChoices question={question as QuestionOf<"dropdown">} />;
}

function MultipleChoiceSettings({ question }: { question: QuestionOf<"multiple_choice"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const { allow_multiple, allow_other, none_of_the_above, randomize, min_selections, max_selections } = question.properties;

  const update = (props: Partial<typeof question.properties>) => {
    updateQuestion(question.id, { properties: { ...question.properties, ...props } }, 0);
  };

  return (
    <>
      <SwitchRow
        label="Multiple selection"
        checked={allow_multiple}
        onChange={(checked) => update({ allow_multiple: checked, min_selections: undefined, max_selections: undefined })}
      />
      {allow_multiple && (
        <div className="flex flex-col gap-2 pl-2">
          <label className="flex items-center gap-2 text-sm text-text">
            <span className="w-16">Min</span>
            <input
              type="number"
              min={1}
              max={max_selections || question.properties.options.length}
              value={min_selections || ""}
              onChange={(e) => update({ min_selections: e.target.value ? parseInt(e.target.value) : undefined })}
              className="h-8 w-20 rounded-field border border-border-strong bg-field px-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <span className="w-16">Max</span>
            <input
              type="number"
              min={min_selections || 1}
              max={question.properties.options.length}
              value={max_selections || ""}
              onChange={(e) => update({ max_selections: e.target.value ? parseInt(e.target.value) : undefined })}
              className="h-8 w-20 rounded-field border border-border-strong bg-field px-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      )}
      <SwitchRow
        label="Randomize"
        checked={randomize || false}
        onChange={(checked) => update({ randomize: checked })}
      />
      <SwitchRow
        label='Add "Other" option'
        checked={allow_other || false}
        onChange={(checked) => update({ allow_other: checked })}
      />
      <SwitchRow
        label='Add "None of the above"'
        checked={none_of_the_above || false}
        onChange={(checked) => update({ none_of_the_above: checked })}
      />
    </>
  );
}

function DropdownChoices({ question }: { question: QuestionOf<"dropdown"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const { options, alphabetical, randomize } = question.properties;
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
      
      <div className="flex flex-col gap-4">
        <SwitchRow
          label="Alphabetical"
          checked={alphabetical || false}
          onChange={(checked) => updateQuestion(question.id, { properties: { ...question.properties, alphabetical: checked, randomize: checked ? false : randomize } }, 0)}
        />
        <SwitchRow
          label="Randomize"
          checked={randomize || false}
          onChange={(checked) => updateQuestion(question.id, { properties: { ...question.properties, randomize: checked, alphabetical: checked ? false : alphabetical } }, 0)}
        />
      </div>

    </div>
  );
}

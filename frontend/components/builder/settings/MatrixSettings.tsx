"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button, IconButton } from "@/components/ui";
import { newOptionId, optionLetter } from "@/lib/questionTypes";
import type { ChoiceOption, QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { SwitchRow } from "../panel/PanelCard";

const MIN_OPTIONS = 1;
const MAX_OPTIONS = 50;
const LABEL_MAX = 500;

export function MatrixSettings({ question }: { question: QuestionOf<"matrix"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const { rows, columns, multiple_selection } = question.properties;
  
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingFocus.current) return;
    inputs.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  function setRows(next: ChoiceOption[], debounceMs?: number) {
    updateQuestion(question.id, { properties: { ...question.properties, rows: next } }, debounceMs);
  }

  function setColumns(next: ChoiceOption[], debounceMs?: number) {
    updateQuestion(question.id, { properties: { ...question.properties, columns: next } }, debounceMs);
  }

  function addRowAfter(index: number) {
    if (rows.length >= MAX_OPTIONS) return;
    const option = { id: newOptionId(), label: "" };
    setRows([...rows.slice(0, index + 1), option, ...rows.slice(index + 1)], 0);
    pendingFocus.current = option.id;
  }

  function addColAfter(index: number) {
    if (columns.length >= MAX_OPTIONS) return;
    const option = { id: newOptionId(), label: "" };
    setColumns([...columns.slice(0, index + 1), option, ...columns.slice(index + 1)], 0);
    pendingFocus.current = option.id;
  }

  function removeRow(index: number) {
    if (rows.length <= MIN_OPTIONS) return;
    setRows(rows.filter((_, i) => i !== index), 0);
    pendingFocus.current = (rows[index - 1] ?? rows[index + 1])?.id ?? null;
  }

  function removeCol(index: number) {
    if (columns.length <= MIN_OPTIONS) return;
    setColumns(columns.filter((_, i) => i !== index), 0);
    pendingFocus.current = (columns[index - 1] ?? columns[index + 1])?.id ?? null;
  }

  function onRowKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRowAfter(index);
    } else if (e.key === "Backspace" && rows[index].label === "" && rows.length > MIN_OPTIONS) {
      e.preventDefault();
      removeRow(index);
    }
  }

  function onColKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      addColAfter(index);
    } else if (e.key === "Backspace" && columns[index].label === "" && columns.length > MIN_OPTIONS) {
      e.preventDefault();
      removeCol(index);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-text-muted">Rows</legend>
        {rows.map((option, i) => (
          <div key={option.id} className="flex items-center gap-2">
            <input
              ref={(el) => {
                if (el) inputs.current.set(option.id, el);
                else inputs.current.delete(option.id);
              }}
              aria-label={`Row ${i + 1}`}
              placeholder={`Row ${i + 1}`}
              value={option.label}
              maxLength={LABEL_MAX}
              onChange={(e) => setRows(rows.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)))}
              onKeyDown={(e) => onRowKeyDown(e, i)}
              className="h-8 min-w-0 flex-1 rounded-field border border-border-strong bg-field px-2.5 text-sm text-text placeholder:text-text-muted focus:border-text-muted focus:outline-none"
            />
            <IconButton
              size="sm"
              label={`Remove row ${i + 1}`}
              icon={<X className="size-4" />}
              disabled={rows.length <= MIN_OPTIONS}
              onClick={() => removeRow(i)}
            />
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          leftIcon={<Plus className="size-4" aria-hidden />}
          disabled={rows.length >= MAX_OPTIONS}
          onClick={() => addRowAfter(rows.length - 1)}
        >
          Add row
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-2 mt-4">
        <legend className="mb-2 text-sm text-text-muted">Columns</legend>
        {columns.map((option, i) => (
          <div key={option.id} className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-input border border-border-strong bg-field text-xs font-semibold text-text-soft">
              {optionLetter(i)}
            </span>
            <input
              ref={(el) => {
                if (el) inputs.current.set(option.id, el);
                else inputs.current.delete(option.id);
              }}
              aria-label={`Column ${optionLetter(i)}`}
              placeholder={`Column ${i + 1}`}
              value={option.label}
              maxLength={LABEL_MAX}
              onChange={(e) => setColumns(columns.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)))}
              onKeyDown={(e) => onColKeyDown(e, i)}
              className="h-8 min-w-0 flex-1 rounded-field border border-border-strong bg-field px-2.5 text-sm text-text placeholder:text-text-muted focus:border-text-muted focus:outline-none"
            />
            <IconButton
              size="sm"
              label={`Remove column ${optionLetter(i)}`}
              icon={<X className="size-4" />}
              disabled={columns.length <= MIN_OPTIONS}
              onClick={() => removeCol(i)}
            />
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          leftIcon={<Plus className="size-4" aria-hidden />}
          disabled={columns.length >= MAX_OPTIONS}
          onClick={() => addColAfter(columns.length - 1)}
        >
          Add column
        </Button>
      </fieldset>

      <div className="mt-2">
        <SwitchRow
          label="Multiple selection"
          checked={multiple_selection}
          onChange={(m) => updateQuestion(question.id, { properties: { ...question.properties, multiple_selection: m } }, 0)}
        />
      </div>
    </div>
  );
}

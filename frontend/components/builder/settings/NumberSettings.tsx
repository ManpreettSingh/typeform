"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import type { NumberProperties, QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { SwitchRow } from "../panel/PanelCard";

const parse = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

/** Typeform's number settings: "Min number" / "Max number", each behind a switch. */
export function NumberSettings({ question }: { question: QuestionOf<"number"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  // Raw strings so half-typed values ("-", "1.") don't get normalised away mid-edit.
  const [min, setMin] = useState(question.properties.min?.toString() ?? "");
  const [max, setMax] = useState(question.properties.max?.toString() ?? "");
  const [minOn, setMinOn] = useState(question.properties.min !== undefined);
  const [maxOn, setMaxOn] = useState(question.properties.max !== undefined);

  const lo = minOn ? parse(min) : undefined;
  const hi = maxOn ? parse(max) : undefined;
  const error =
    (lo !== undefined && Number.isNaN(lo)) || (hi !== undefined && Number.isNaN(hi))
      ? "Enter a valid number"
      : lo !== undefined && hi !== undefined && lo > hi
        ? "Max must be greater than or equal to min"
        : undefined;

  function save(next: { min: string; max: string; minOn: boolean; maxOn: boolean }) {
    const a = next.minOn ? parse(next.min) : undefined;
    const b = next.maxOn ? parse(next.max) : undefined;
    if ((a !== undefined && Number.isNaN(a)) || (b !== undefined && Number.isNaN(b))) return;
    if (a !== undefined && b !== undefined && a > b) return; // invalid: keep local, don't save
    const properties: NumberProperties = {};
    if (a !== undefined) properties.min = a;
    if (b !== undefined) properties.max = b;
    updateQuestion(question.id, { properties });
  }

  const state = { min, max, minOn, maxOn };
  const field = (value: string, label: string, onChange: (raw: string) => void) => (
    <Input
      aria-label={label}
      type="number"
      inputMode="decimal"
      placeholder="0"
      value={value}
      aria-invalid={error ? true : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  return (
    <>
      <SwitchRow
        label="Min number"
        checked={minOn}
        onChange={(on) => {
          setMinOn(on);
          save({ ...state, minOn: on });
        }}
      >
        {field(min, "Min", (raw) => {
          setMin(raw);
          save({ ...state, min: raw });
        })}
      </SwitchRow>
      <SwitchRow
        label="Max number"
        checked={maxOn}
        onChange={(on) => {
          setMaxOn(on);
          save({ ...state, maxOn: on });
        }}
      >
        {field(max, "Max", (raw) => {
          setMax(raw);
          save({ ...state, max: raw });
        })}
      </SwitchRow>
      {error && (
        <p role="alert" className="pb-2 text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}

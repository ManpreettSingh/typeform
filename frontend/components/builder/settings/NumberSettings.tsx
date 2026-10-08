"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import type { NumberProperties, QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

const parse = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export function NumberSettings({ question }: { question: QuestionOf<"number"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  // Raw strings so half-typed values ("-", "1.") don't get normalised away mid-edit.
  const [min, setMin] = useState(question.properties.min?.toString() ?? "");
  const [max, setMax] = useState(question.properties.max?.toString() ?? "");

  const minValue = parse(min);
  const maxValue = parse(max);
  const error =
    (minValue !== undefined && Number.isNaN(minValue)) || (maxValue !== undefined && Number.isNaN(maxValue))
      ? "Enter a valid number"
      : minValue !== undefined && maxValue !== undefined && minValue > maxValue
        ? "Max must be greater than or equal to min"
        : undefined;

  function save(nextMin: string, nextMax: string) {
    const lo = parse(nextMin);
    const hi = parse(nextMax);
    if ((lo !== undefined && Number.isNaN(lo)) || (hi !== undefined && Number.isNaN(hi))) return;
    if (lo !== undefined && hi !== undefined && lo > hi) return; // invalid: keep local, don't save
    const properties: NumberProperties = {};
    if (lo !== undefined) properties.min = lo;
    if (hi !== undefined) properties.max = hi;
    updateQuestion(question.id, { properties });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Min"
          type="number"
          inputMode="decimal"
          placeholder="No limit"
          value={min}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setMin(e.target.value);
            save(e.target.value, max);
          }}
        />
        <Input
          label="Max"
          type="number"
          inputMode="decimal"
          placeholder="No limit"
          value={max}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setMax(e.target.value);
            save(min, e.target.value);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

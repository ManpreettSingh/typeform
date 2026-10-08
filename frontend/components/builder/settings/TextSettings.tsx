"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import type { QuestionOf, TextProperties } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

// Mirrors backend limits (schemas/properties.py).
const PLACEHOLDER_MAX = 200;
const MAX_LENGTH_LIMIT = 10_000;

export function TextSettings({ question }: { question: QuestionOf<"short_text"> | QuestionOf<"long_text"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const props = question.properties;
  const [maxLength, setMaxLength] = useState(props.max_length?.toString() ?? "");

  const parsed = maxLength.trim() === "" ? undefined : Number(maxLength);
  const maxLengthError =
    parsed !== undefined && (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LENGTH_LIMIT)
      ? `Enter a whole number from 1 to ${MAX_LENGTH_LIMIT.toLocaleString()}`
      : undefined;

  function save(next: TextProperties) {
    const properties: TextProperties = {};
    if (next.placeholder) properties.placeholder = next.placeholder;
    if (next.max_length !== undefined) properties.max_length = next.max_length;
    updateQuestion(question.id, { properties });
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Placeholder"
        placeholder="Type your answer here..."
        value={props.placeholder ?? ""}
        maxLength={PLACEHOLDER_MAX}
        onChange={(e) => save({ ...props, placeholder: e.target.value })}
      />
      <Input
        label="Max characters"
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_LENGTH_LIMIT}
        placeholder="No limit"
        value={maxLength}
        error={maxLengthError}
        onChange={(e) => {
          const raw = e.target.value;
          setMaxLength(raw);
          const value = raw.trim() === "" ? undefined : Number(raw);
          if (value === undefined || (Number.isInteger(value) && value >= 1 && value <= MAX_LENGTH_LIMIT)) {
            save({ ...props, max_length: value });
          }
        }}
      />
    </div>
  );
}

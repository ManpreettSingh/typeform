"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import type { QuestionOf, TextProperties } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { SwitchRow } from "../panel/PanelCard";

// Mirrors backend limits (schemas/properties.py).
const PLACEHOLDER_MAX = 200;
const MAX_LENGTH_LIMIT = 10_000;
const DEFAULT_MAX_LENGTH = 200;

/** Typeform's text settings: "Max characters" and "Custom placeholder text", each behind a switch. */
export function TextSettings({ question }: { question: QuestionOf<"short_text"> | QuestionOf<"long_text"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const props = question.properties;
  const [limitOn, setLimitOn] = useState(props.max_length !== undefined);
  const [placeholderOn, setPlaceholderOn] = useState(props.placeholder !== undefined);
  // Raw text so a half-typed number isn't normalised away mid-edit.
  const [maxLength, setMaxLength] = useState(String(props.max_length ?? DEFAULT_MAX_LENGTH));

  const parsed = Number(maxLength);
  const maxLengthError =
    limitOn && (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LENGTH_LIMIT)
      ? `Enter a whole number from 1 to ${MAX_LENGTH_LIMIT.toLocaleString()}`
      : undefined;

  function save(next: TextProperties, debounceMs?: number) {
    const properties: TextProperties = {};
    if (next.placeholder) properties.placeholder = next.placeholder;
    if (next.max_length !== undefined) properties.max_length = next.max_length;
    updateQuestion(question.id, { properties }, debounceMs);
  }

  return (
    <>
      <SwitchRow
        label="Max characters"
        checked={limitOn}
        onChange={(on) => {
          setLimitOn(on);
          const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_LENGTH_LIMIT;
          save({ ...props, max_length: on && valid ? parsed : undefined }, 0);
        }}
      >
        <Input
          aria-label="Max characters"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_LENGTH_LIMIT}
          value={maxLength}
          error={maxLengthError}
          onChange={(e) => {
            const raw = e.target.value;
            setMaxLength(raw);
            const value = Number(raw);
            if (raw.trim() !== "" && Number.isInteger(value) && value >= 1 && value <= MAX_LENGTH_LIMIT) {
              save({ ...props, max_length: value });
            }
          }}
        />
      </SwitchRow>
      <SwitchRow
        label="Custom placeholder text"
        checked={placeholderOn}
        onChange={(on) => {
          setPlaceholderOn(on);
          if (!on) save({ ...props, placeholder: undefined }, 0);
        }}
      >
        <Input
          aria-label="Placeholder"
          placeholder="Type your answer here..."
          value={props.placeholder ?? ""}
          maxLength={PLACEHOLDER_MAX}
          onChange={(e) => save({ ...props, placeholder: e.target.value })}
        />
      </SwitchRow>
    </>
  );
}

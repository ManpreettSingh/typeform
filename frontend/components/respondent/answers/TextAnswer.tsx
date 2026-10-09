"use client";

import { useEffect, useState } from "react";
import type { AnswerProps } from "../types";
import { FIELD, submitOnEnter, useAutofocus } from "./shared";

export function ShortTextAnswer({ question, value, onChange, onSubmit, live, labelledBy }: AnswerProps<"short_text">) {
  const ref = useAutofocus<HTMLInputElement>(live);
  return (
    <input
      ref={ref}
      aria-labelledby={labelledBy}
      className={FIELD}
      placeholder={question.properties.placeholder || "Type your answer here..."}
      maxLength={question.properties.max_length}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={submitOnEnter(onSubmit)}
    />
  );
}

export function EmailAnswer({ value, onChange, onSubmit, live, labelledBy }: AnswerProps<"email">) {
  const ref = useAutofocus<HTMLInputElement>(live);
  return (
    <input
      ref={ref}
      type="email"
      inputMode="email"
      autoComplete="email"
      aria-labelledby={labelledBy}
      className={FIELD}
      placeholder="name@example.com"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={submitOnEnter(onSubmit)}
    />
  );
}

export function LongTextAnswer({ question, value, onChange, onSubmit, live, labelledBy }: AnswerProps<"long_text">) {
  const ref = useAutofocus<HTMLTextAreaElement>(live);

  // Grow with the content, like Typeform.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);

  return (
    <textarea
      ref={ref}
      rows={1}
      aria-labelledby={labelledBy}
      className={`${FIELD} resize-none overflow-hidden`}
      placeholder={question.properties.placeholder || "Type your answer here..."}
      maxLength={question.properties.max_length}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={submitOnEnter(onSubmit)}
    />
  );
}

export function NumberAnswer({ value, onChange, onSubmit, live, labelledBy }: AnswerProps<"number">) {
  const ref = useAutofocus<HTMLInputElement>(live);
  // Raw text so "-" or "1." can be typed; emits a number when it parses, the raw string otherwise.
  const [raw, setRaw] = useState(value === undefined ? "" : String(value));

  return (
    <input
      ref={ref}
      inputMode="decimal"
      aria-labelledby={labelledBy}
      className={FIELD}
      placeholder="Type your answer here..."
      value={raw}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        const trimmed = next.trim();
        const parsed = Number(trimmed);
        onChange(trimmed === "" ? undefined : Number.isFinite(parsed) ? parsed : next);
      }}
      onKeyDown={submitOnEnter(onSubmit)}
    />
  );
}

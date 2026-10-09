"use client";

import type { AnswerProps } from "../types";
import { FIELD, submitOnEnter, useAutofocus } from "./shared";

export function WebsiteAnswer({ value, onChange, onSubmit, live, labelledBy }: AnswerProps<"website">) {
  const ref = useAutofocus<HTMLInputElement>(live);
  return (
    <input
      ref={ref}
      type="url"
      inputMode="url"
      autoComplete="url"
      aria-labelledby={labelledBy}
      className={FIELD}
      placeholder="https://"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={submitOnEnter(onSubmit)}
    />
  );
}

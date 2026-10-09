"use client";

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { dateRangeHint } from "@/lib/questionTypes/dates";
import type { AnswerProps } from "../types";
import { FIELD_LINE, submitOnEnter } from "./shared";

type PartKey = "month" | "day" | "year";
type Parts = Record<PartKey, string>;

const PART_META: Record<string, { key: PartKey; label: string; placeholder: string; max: number; width: string }> = {
  MM: { key: "month", label: "Month", placeholder: "MM", max: 2, width: "w-14 sm:w-[4.5rem]" },
  DD: { key: "day", label: "Day", placeholder: "DD", max: 2, width: "w-14 sm:w-[4.5rem]" },
  YYYY: { key: "year", label: "Year", placeholder: "YYYY", max: 4, width: "w-24 sm:w-32" },
};

function partsOf(value: string | undefined): Parts {
  const [year = "", month = "", day = ""] = (value ?? "").split("-");
  return { year, month, day };
}

/** "YYYY-MM-DD" once every part is filled in; a rough "YYYY-M-D" while it isn't, which validation reads as incomplete. */
function compose({ year, month, day }: Parts): string | undefined {
  if (!year && !month && !day) return undefined;
  if (year.length === 4 && month && day) return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return `${year}-${month}-${day}`;
}

/**
 * Typeform's date input: Month / Day / Year boxes in the question's order, each with its own underline.
 * Typing a full part moves on to the next; Backspace in an empty part goes back.
 */
export function DateAnswer({ question, value, onChange, onSubmit, live, labelledBy }: AnswerProps<"date">) {
  const props = question.properties;
  const order = (props.format.match(/MM|DD|YYYY/g) ?? ["MM", "DD", "YYYY"]).map((token) => PART_META[token]);
  const [parts, setParts] = useState<Parts>(() => partsOf(value));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const hint = dateRangeHint(props);

  useEffect(() => {
    if (live) inputs.current[0]?.focus({ preventScroll: true });
  }, [live]);

  function change(index: number, raw: string) {
    const meta = order[index];
    const digits = raw.replace(/\D/g, "").slice(0, meta.max);
    const next = { ...parts, [meta.key]: digits };
    setParts(next);
    onChange(compose(next));
    if (digits.length === meta.max) inputs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !parts[order[index].key]) inputs.current[index - 1]?.focus();
    else submitOnEnter(onSubmit)(e);
  }

  return (
    <div role="group" aria-labelledby={labelledBy}>
      <div className="flex items-end gap-2 sm:gap-3">
        {order.map((meta, i) => (
          <Fragment key={meta.key}>
            {i > 0 && (
              <span aria-hidden className="pb-2 text-2xl font-light text-resp-accent/40 sm:text-3xl">
                {props.separator}
              </span>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-sm text-resp-accent/70">{meta.label}</span>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete="off"
                className={`${FIELD_LINE} ${meta.width}`}
                placeholder={meta.placeholder}
                value={parts[meta.key]}
                onChange={(e) => change(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
              />
            </label>
          </Fragment>
        ))}
      </div>
      {hint && <p className="mt-3 text-sm text-resp-accent/70">{hint}</p>}
    </div>
  );
}

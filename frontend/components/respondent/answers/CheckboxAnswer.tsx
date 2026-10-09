"use client";

import type { AnswerProps } from "../types";
import { ChoiceButton } from "./ChoiceAnswer";
import { useShortcutKeys } from "./useShortcutKeys";

/** A single checkbox for consent ("I agree to the terms"). An untouched box leaves the question unanswered. */
export function CheckboxAnswer({ question, value, onChange, live, labelledBy }: AnswerProps<"checkbox">) {
  const checked = value === true;
  const toggle = () => onChange(checked ? undefined : true);

  useShortcutKeys(live, (key) => {
    if (key !== "A") return false;
    toggle();
    return true;
  });

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex max-w-md flex-col gap-2">
      <ChoiceButton keyLabel="A" selected={checked} multi onClick={toggle}>
        {question.properties.label || <span className="opacity-60">Checkbox label</span>}
      </ChoiceButton>
    </div>
  );
}

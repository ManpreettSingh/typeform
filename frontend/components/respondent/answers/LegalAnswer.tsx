"use client";

import { AUTO_ADVANCE_MS, type AnswerProps } from "../types";
import { ChoiceButton } from "./ChoiceAnswer";
import { useDelayedCall, useShortcutKeys } from "./useShortcutKeys";

/** Typeform's Legal block: the question holds the notice; the respondent answers "I accept" or "I don’t accept". */
export function LegalAnswer({ value, onChange, onSubmit, live, autoAdvance, labelledBy }: AnswerProps<"legal">) {
  const later = useDelayedCall();

  function pick(accepted: boolean) {
    onChange(accepted);
    if (autoAdvance) later(onSubmit, AUTO_ADVANCE_MS);
  }

  useShortcutKeys(live, (key) => {
    if (key !== "Y" && key !== "N") return false;
    pick(key === "Y");
    return true;
  });

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex max-w-xs flex-col gap-2">
      <ChoiceButton keyLabel="Y" selected={value === true} multi={false} onClick={() => pick(true)}>
        I accept
      </ChoiceButton>
      <ChoiceButton keyLabel="N" selected={value === false} multi={false} onClick={() => pick(false)}>
        I don’t accept
      </ChoiceButton>
    </div>
  );
}

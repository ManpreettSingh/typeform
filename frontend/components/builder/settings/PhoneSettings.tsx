"use client";

import { useId } from "react";
import { CountryPicker } from "@/components/ui/CountryPicker";
import type { QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

/** The phone question's country: the flag list Typeform shows under Required. */
export function PhoneSettings({ question }: { question: QuestionOf<"phone_number"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5 pb-2">
      <label htmlFor={id} className="text-sm text-text-muted">
        Default country
      </label>
      <CountryPicker
        id={id}
        tone="panel"
        showName
        value={question.properties.default_country}
        onChange={(default_country) =>
          updateQuestion(question.id, { properties: { ...question.properties, default_country } }, 0)
        }
      />
    </div>
  );
}

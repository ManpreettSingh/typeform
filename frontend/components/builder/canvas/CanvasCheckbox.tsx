"use client";

import type { QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

// Mirrors backend limit (schemas/properties.py).
const LABEL_MAX = 500;

/** The checkbox's label edited right on the canvas, like Typeform's "checkbox description" field. */
export function CanvasCheckbox({ question }: { question: QuestionOf<"checkbox"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);

  return (
    <div className="flex max-w-md flex-col gap-2">
      <div className="flex h-11 items-center gap-3 rounded-input border border-resp-accent/40 bg-resp-accent/10 pr-3 pl-3 text-lg text-resp-accent focus-within:border-resp-accent sm:text-xl">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-input border border-resp-accent/50 bg-resp-bg text-xs font-semibold"
        >
          A
        </span>
        <input
          aria-label="Checkbox label"
          placeholder="Checkbox label"
          value={question.properties.label}
          maxLength={LABEL_MAX}
          onChange={(e) => updateQuestion(question.id, { properties: { label: e.target.value } })}
          className="min-w-0 flex-1 bg-transparent placeholder:italic placeholder:opacity-50 focus:outline-none"
        />
      </div>
    </div>
  );
}

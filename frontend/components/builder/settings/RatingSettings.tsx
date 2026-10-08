"use client";

import { Select } from "@/components/ui";
import { RATING_MAX_RANGE, type QuestionOf, type RatingShape } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

const STEPS = Array.from({ length: RATING_MAX_RANGE.max - RATING_MAX_RANGE.min + 1 }, (_, i) => {
  const value = RATING_MAX_RANGE.min + i;
  return { value, label: String(value) };
});

const SHAPES: { value: RatingShape; label: string }[] = [
  { value: "star", label: "Stars" },
  { value: "heart", label: "Hearts" },
  { value: "number", label: "Numbers" },
];

export function RatingSettings({ question }: { question: QuestionOf<"rating"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const props = question.properties;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        label="Steps"
        options={STEPS}
        value={props.max}
        onChange={(max) => updateQuestion(question.id, { properties: { ...props, max } }, 0)}
      />
      <Select
        label="Shape"
        options={SHAPES}
        value={props.shape}
        onChange={(shape) => updateQuestion(question.id, { properties: { ...props, shape } }, 0)}
      />
    </div>
  );
}

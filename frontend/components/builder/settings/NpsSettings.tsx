"use client";

import type { QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { ScaleLabelsFields } from "./ScaleLabelsFields";

/** NPS always asks 0–10, so the only setting is the captions under the scale. */
export function NpsSettings({ question }: { question: QuestionOf<"nps"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  return (
    <ScaleLabelsFields
      labels={question.properties.labels}
      onChange={(labels) => updateQuestion(question.id, { properties: { labels } })}
    />
  );
}

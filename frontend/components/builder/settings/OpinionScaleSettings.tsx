"use client";

import { useId } from "react";
import { Select } from "@/components/ui";
import { OPINION_SCALE_STEPS, type QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { SettingRow, SwitchRow } from "../panel/PanelCard";
import { ScaleLabelsFields } from "./ScaleLabelsFields";

const STEPS = Array.from({ length: OPINION_SCALE_STEPS.max - OPINION_SCALE_STEPS.min + 1 }, (_, i) => {
  const value = OPINION_SCALE_STEPS.min + i;
  return { value, label: String(value) };
});

/** Typeform's Opinion Scale panel: Steps (5–11), "Start at 1", and the three captions. */
export function OpinionScaleSettings({ question }: { question: QuestionOf<"opinion_scale"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const props = question.properties;
  const stepsId = useId();

  return (
    <>
      <SettingRow label="Steps" htmlFor={stepsId}>
        <div className="w-28">
          <Select
            id={stepsId}
            options={STEPS}
            value={props.steps}
            onChange={(steps) => updateQuestion(question.id, { properties: { ...props, steps } }, 0)}
          />
        </div>
      </SettingRow>
      <SwitchRow
        label="Start at 1"
        checked={props.start_at_one}
        onChange={(start_at_one) => updateQuestion(question.id, { properties: { ...props, start_at_one } }, 0)}
      />
      <ScaleLabelsFields
        labels={props.labels}
        onChange={(labels) => updateQuestion(question.id, { properties: { ...props, labels } })}
      />
    </>
  );
}

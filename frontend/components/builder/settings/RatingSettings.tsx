"use client";

import { useId } from "react";
import { Select } from "@/components/ui";
import { RATING_MAX_RANGE, type QuestionOf, type RatingShape } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { SettingRow } from "../panel/PanelCard";

const STEPS = Array.from({ length: RATING_MAX_RANGE.max - RATING_MAX_RANGE.min + 1 }, (_, i) => {
  const value = RATING_MAX_RANGE.min + i;
  return { value, label: String(value) };
});

const SHAPES: { value: RatingShape; label: string }[] = [
  { value: "star", label: "Stars" },
  { value: "heart", label: "Hearts" },
  { value: "crown", label: "Crowns" },
  { value: "cat", label: "Cats" },
  { value: "dog", label: "Dogs" },
  { value: "droplet", label: "Droplets" },
  { value: "flag", label: "Flags" },
  { value: "lightbulb", label: "Lightbulbs" },
  { value: "pencil", label: "Pencils" },
  { value: "skull", label: "Skulls" },
  { value: "thunderbolt", label: "Thunderbolts" },
  { value: "tick", label: "Ticks" },
  { value: "trophy", label: "Trophies" },
  { value: "up", label: "Thumbs Up" },
  { value: "user", label: "Users" },
  { value: "circle", label: "Circles" },
  { value: "cloud", label: "Clouds" },
  { value: "number", label: "Numbers" },
];

export function RatingSettings({ question }: { question: QuestionOf<"rating"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const props = question.properties;
  const stepsId = useId();
  const shapeId = useId();

  return (
    <>
      <SettingRow label="Steps" htmlFor={stepsId}>
        <div className="w-28">
          <Select
            id={stepsId}
            options={STEPS}
            value={props.max}
            onChange={(max) => updateQuestion(question.id, { properties: { ...props, max } }, 0)}
          />
        </div>
      </SettingRow>
      <SettingRow label="Shape" htmlFor={shapeId}>
        <div className="w-28">
          <Select
            id={shapeId}
            options={SHAPES}
            value={props.shape}
            onChange={(shape) => updateQuestion(question.id, { properties: { ...props, shape } }, 0)}
          />
        </div>
      </SettingRow>
    </>
  );
}

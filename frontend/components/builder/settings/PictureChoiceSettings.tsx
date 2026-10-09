import { SwitchRow } from "../panel/PanelCard";
import type { QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

export function PictureChoiceSettings({ question }: { question: QuestionOf<"picture_choice"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const p = question.properties;

  return (
    <>
      <SwitchRow
        label="Multiple selection"
        checked={p.allow_multiple}
        onChange={(allow_multiple) => updateQuestion(question.id, { properties: { ...p, allow_multiple } })}
      />
      <SwitchRow
        label="Show labels"
        checked={p.show_labels}
        onChange={(show_labels) => updateQuestion(question.id, { properties: { ...p, show_labels } })}
      />
      <SwitchRow
        label="Supersized"
        checked={p.supersized}
        onChange={(supersized) => updateQuestion(question.id, { properties: { ...p, supersized } })}
      />
      <SwitchRow
        label="Randomize"
        checked={p.randomize}
        onChange={(randomize) => updateQuestion(question.id, { properties: { ...p, randomize } })}
      />
    </>
  );
}

import { Input } from "@/components/ui";
import type { QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

export function GroupSettings({ question }: { question: QuestionOf<"group"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`group-btn-${question.id}`} className="text-sm font-medium">
        Button text
      </label>
      <Input
        id={`group-btn-${question.id}`}
        value={question.properties.button_text ?? "Continue"}
        onChange={(e) =>
          updateQuestion(question.id, {
            properties: { ...question.properties, button_text: e.target.value },
          })
        }
      />
    </div>
  );
}

import { type QuestionOf, type StatementProperties } from "@/lib/types";
import { Input, Toggle } from "@/components/ui";
import { useBuilderStore } from "@/store/builderStore";

export function StatementSettings({ question }: { question: QuestionOf<"statement"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const updateProps = (props: Partial<StatementProperties>) => updateQuestion(question.id, { properties: { ...question.properties, ...props } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Button text</label>
        <Input
          className="w-[180px]"
          value={question.properties.button_text}
          onChange={(e) => updateProps({ button_text: e.target.value })}
          maxLength={24}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Hide quotation marks</label>
        <Toggle
          checked={question.properties.hide_marks}
          onChange={(checked: boolean) => updateProps({ hide_marks: checked })}
        />
      </div>
    </div>
  );
}

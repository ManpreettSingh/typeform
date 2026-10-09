import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { useBuilderStore } from "@/store/builderStore";
import { QUESTION_TYPE_META } from "@/lib/questionTypes";
import type { QuestionType, Question } from "@/lib/types";
import { QuestionTypeChip } from "../QuestionTypeChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu, type MenuItem, type MenuTriggerProps } from "@/components/ui/Menu";

export function AnswerTypeSelect({ question }: { question: Question }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const [pendingType, setPendingType] = useState<QuestionType | null>(null);

  // Group types that can be changed into. Exclude group and statement
  const answerableGroups = Array.from(
    new Set(
      Object.entries(QUESTION_TYPE_META)
        .filter(([type]) => type !== "group" && type !== "statement")
        .map(([, meta]) => meta.group)
    )
  );

  const handleSelect = (newType: QuestionType) => {
    if (newType === question.type) return;
    setPendingType(newType);
  };

  const confirmChange = () => {
    if (pendingType) {
      updateQuestion(question.id, { type: pendingType }, 0);
      setPendingType(null);
    }
  };

  const items: MenuItem[] = answerableGroups.flatMap((group, index) => {
    const typesInGroup = Object.entries(QUESTION_TYPE_META).filter(
      ([type, meta]) => meta.group === group && type !== "group" && type !== "statement"
    );

    const groupHeader: MenuItem = { 
      label: group, 
      onSelect: () => {}, 
      disabled: true,
      separatorBefore: index > 0,
    };
    
    const types: MenuItem[] = typesInGroup.map(([type, meta]) => ({
      label: meta.label,
      onSelect: () => handleSelect(type as QuestionType),
      icon: <QuestionTypeChip type={type as QuestionType} />,
      hint: question.type === type ? <Check className="size-4" /> : undefined,
    }));

    return [groupHeader, ...types];
  });

  return (
    <>
      <Menu
        items={items}
        trigger={(props: MenuTriggerProps) => (
          <button
            {...props}
            title="Change question type"
            className="flex h-9 w-full items-center justify-between gap-2.5 rounded-field border border-border bg-field px-1.5 text-sm text-text hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            <div className="flex items-center gap-2.5">
              <QuestionTypeChip type={question.type} />
              {QUESTION_TYPE_META[question.type].label}
            </div>
            <ChevronDown className="size-4 text-text-muted" />
          </button>
        )}
      />

      <ConfirmDialog
        open={pendingType !== null}
        onClose={() => setPendingType(null)}
        title="Change question type?"
        message="Changing the type will remove any answers already collected for this question. Do you want to proceed?"
        confirmLabel="Change type"
        destructive
        onConfirm={confirmChange}
      />
    </>
  );
}

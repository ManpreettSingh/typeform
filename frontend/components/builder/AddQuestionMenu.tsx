"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Menu, type ButtonProps } from "@/components/ui";
import { QUESTION_TYPE_LIST } from "@/lib/questionTypes";
import { useBuilderStore } from "@/store/builderStore";
import { QuestionTypeChip } from "./QuestionTypeChip";

/** "+ Add question" button with a type-picker popover. */
export function AddQuestionMenu({ variant = "secondary" }: { variant?: ButtonProps["variant"] }) {
  const addQuestion = useBuilderStore((s) => s.addQuestion);
  const [adding, setAdding] = useState(false);

  async function add(type: Parameters<typeof addQuestion>[0]) {
    setAdding(true);
    try {
      await addQuestion(type);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Menu
      align="start"
      items={QUESTION_TYPE_LIST.map(({ type, label }) => ({
        label,
        icon: <QuestionTypeChip type={type} />,
        onSelect: () => void add(type),
      }))}
      trigger={(props) => (
        <Button
          {...props}
          size="sm"
          variant={variant}
          loading={adding}
          leftIcon={<Plus className="size-4" aria-hidden />}
        >
          Add question
        </Button>
      )}
    />
  );
}

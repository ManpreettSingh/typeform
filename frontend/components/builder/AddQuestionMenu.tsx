"use client";

import { CreditCard, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { Button, Menu, type ButtonProps } from "@/components/ui";
import { QUESTION_TYPE_LIST } from "@/lib/questionTypes";
import { useBuilderStore } from "@/store/builderStore";
import { QuestionTypeChip } from "./QuestionTypeChip";

const COMING_SOON_TYPES = [
  { label: "Payment", icon: CreditCard },
  { label: "File upload", icon: Upload },
];

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
      items={[
        ...QUESTION_TYPE_LIST.map(({ type, label }) => ({
          label,
          icon: <QuestionTypeChip type={type} />,
          onSelect: () => void add(type),
        })),
        // Out of scope for this build: listed so the type picker looks complete, but disabled.
        ...COMING_SOON_TYPES.map(({ label, icon: Icon }, i) => ({
          label,
          icon: (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-input bg-bg-subtle text-text-muted">
              <Icon className="size-3.5" aria-hidden />
            </span>
          ),
          description: "Coming soon",
          disabled: true,
          separatorBefore: i === 0,
          onSelect: () => {},
        })),
      ]}
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

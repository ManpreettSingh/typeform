import { clsx } from "clsx";
import { QUESTION_TYPE_META } from "@/lib/questionTypes";
import type { QuestionType } from "@/lib/types";

export function QuestionTypeChip({ type, className }: { type: QuestionType; className?: string }) {
  const { icon: Icon, chip, label } = QUESTION_TYPE_META[type];
  return (
    <span
      title={label}
      className={clsx("inline-flex size-6 shrink-0 items-center justify-center rounded-input", chip, className)}
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}

"use client";

import { MousePointerClick, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, EmptyState, Textarea, Toggle } from "@/components/ui";
import { QUESTION_TYPE_META } from "@/lib/questionTypes";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { QuestionTypeChip } from "./QuestionTypeChip";
import { ChoiceSettings } from "./settings/ChoiceSettings";
import { NumberSettings } from "./settings/NumberSettings";
import { RatingSettings } from "./settings/RatingSettings";
import { TextSettings } from "./settings/TextSettings";

const TITLE_MAX = 1000;
const DESCRIPTION_MAX = 2000;

export function QuestionSettings({ onDelete }: { onDelete: (question: Question) => void }) {
  const question = useBuilderStore((s) => s.questions.find((q) => q.id === s.selectedId));
  const index = useBuilderStore((s) => s.questions.findIndex((q) => q.id === s.selectedId));

  if (!question) {
    return (
      <EmptyState
        className="py-10"
        icon={<MousePointerClick className="size-6" />}
        title="No question selected"
        description="Pick a question on the left to edit it."
      />
    );
  }
  // Keyed so per-editor local state (e.g. half-typed numbers) resets between questions.
  return <Fields key={question.id} question={question} number={index + 1} onDelete={onDelete} />;
}

function Fields({
  question,
  number,
  onDelete,
}: {
  question: Question;
  number: number;
  onDelete: (question: Question) => void;
}) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const isUntitled = !question.title;

  // A freshly added question starts untitled: put the cursor straight into its title.
  useEffect(() => {
    if (isUntitled) titleRef.current?.focus();
    // Only on first render for this question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <QuestionTypeChip type={question.type} />
        <span className="font-medium text-text">{QUESTION_TYPE_META[question.type].label}</span>
        <span>· Question {number}</span>
      </div>

      <Textarea
        ref={titleRef}
        label="Question"
        placeholder="Your question here."
        value={question.title}
        maxLength={TITLE_MAX}
        onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
      />
      <Textarea
        label="Description"
        placeholder="Optional help text shown under the question"
        value={question.description ?? ""}
        maxLength={DESCRIPTION_MAX}
        onChange={(e) => updateQuestion(question.id, { description: e.target.value || null })}
      />
      <Toggle
        label="Required"
        checked={question.required}
        onChange={(required) => updateQuestion(question.id, { required }, 0)}
      />

      <section className="flex flex-col gap-4 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-text">Settings</h3>
        <TypeSettings question={question} />
      </section>

      <div className="border-t border-border pt-4">
        <Button variant="dangerGhost" size="sm" leftIcon={<Trash2 className="size-4" aria-hidden />} onClick={() => onDelete(question)}>
          Delete question
        </Button>
      </div>
    </div>
  );
}

function TypeSettings({ question }: { question: Question }) {
  switch (question.type) {
    case "multiple_choice":
    case "dropdown":
      return <ChoiceSettings question={question} />;
    case "rating":
      return <RatingSettings question={question} />;
    case "number":
      return <NumberSettings question={question} />;
    case "short_text":
    case "long_text":
      return <TextSettings question={question} />;
    case "email":
    case "yes_no":
      return <p className="text-sm text-text-muted">No extra settings for this question type.</p>;
  }
}

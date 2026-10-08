"use client";

import { useId } from "react";
import type { AnswerValue, PublicQuestion } from "@/lib/types";
import { DropdownAnswer } from "./answers/DropdownAnswer";
import { MultipleChoiceAnswer, YesNoAnswer } from "./answers/ChoiceAnswer";
import { RatingAnswer } from "./answers/RatingAnswer";
import { EmailAnswer, LongTextAnswer, NumberAnswer, ShortTextAnswer } from "./answers/TextAnswer";
import { QuestionShell } from "./QuestionShell";
import type { RenderMode } from "./types";

export type QuestionRendererProps = {
  question: PublicQuestion;
  number: number;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  onSubmit: () => void;
  error?: string | null;
  /** Changes on every rejected attempt so the error message shakes again. */
  errorKey?: number;
  mode: RenderMode;
  isLast?: boolean;
  submitting?: boolean;
};

/** One question as respondents see it. Used by the live flow, the full preview and the builder canvas. */
export function QuestionRenderer({
  question,
  number,
  value,
  onChange,
  onSubmit,
  error,
  errorKey,
  mode,
  isLast,
  submitting,
}: QuestionRendererProps) {
  const titleId = useId();
  const live = mode === "live";
  const common = { onSubmit, live, autoAdvance: live && !isLast, labelledBy: titleId };

  // Each branch narrows `question` and casts the shared value/onChange to that type's answer shape.
  const answer = (() => {
    switch (question.type) {
      case "short_text":
        return <ShortTextAnswer {...common} question={question} value={value as string} onChange={onChange} />;
      case "long_text":
        return <LongTextAnswer {...common} question={question} value={value as string} onChange={onChange} />;
      case "email":
        return <EmailAnswer {...common} question={question} value={value as string} onChange={onChange} />;
      case "number":
        return <NumberAnswer {...common} question={question} value={value as number | string} onChange={onChange} />;
      case "multiple_choice":
        return (
          <MultipleChoiceAnswer {...common} question={question} value={value as string | string[]} onChange={onChange} />
        );
      case "dropdown":
        return <DropdownAnswer {...common} question={question} value={value as string} onChange={onChange} />;
      case "yes_no":
        return <YesNoAnswer {...common} question={question} value={value as boolean} onChange={onChange} />;
      case "rating":
        return <RatingAnswer {...common} question={question} value={value as number} onChange={onChange} />;
    }
  })();

  return (
    <QuestionShell
      number={number}
      title={question.title}
      titleId={titleId}
      description={question.description}
      required={question.required}
      error={error}
      errorKey={errorKey}
      submitLabel={isLast ? "Submit" : "OK"}
      submitting={submitting}
      onSubmit={onSubmit}
      hint={
        question.type === "long_text" ? (
          <>
            <strong>Shift ⇧ + Enter ↵</strong> to make a line break
          </>
        ) : undefined
      }
    >
      {answer}
    </QuestionShell>
  );
}

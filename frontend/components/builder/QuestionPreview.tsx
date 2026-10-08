"use client";

import { useState } from "react";
import { QuestionRenderer } from "@/components/respondent/QuestionRenderer";
import { RespondentTheme } from "@/components/respondent/RespondentTheme";
import type { AnswerValue, Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

/** Builder canvas: the selected question rendered by the real respondent components (preview mode). */
export function QuestionPreview() {
  const question = useBuilderStore((s) => s.questions.find((q) => q.id === s.selectedId));
  const number = useBuilderStore((s) => s.questions.findIndex((q) => q.id === s.selectedId) + 1);
  const total = useBuilderStore((s) => s.questions.length);
  const theme = useBuilderStore((s) => s.form!.theme);

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <RespondentTheme
        theme={theme}
        className="flex min-h-[28rem] w-full max-w-3xl items-center justify-center rounded-card px-10 py-14 shadow-popover"
      >
        {question ? (
          // Keyed: the try-it-out answer resets when another question is selected.
          <CanvasQuestion key={question.id} question={question} number={number} isLast={number === total} />
        ) : (
          <p className="opacity-60">Add a question to see a preview here.</p>
        )}
      </RespondentTheme>
    </div>
  );
}

function CanvasQuestion({ question, number, isLast }: { question: Question; number: number; isLast: boolean }) {
  // Creators can click around to try the question; nothing is saved.
  const [value, setValue] = useState<AnswerValue | undefined>();
  return (
    <QuestionRenderer
      question={question}
      number={number}
      value={value}
      onChange={setValue}
      onSubmit={() => {}}
      mode="preview"
      isLast={isLast}
    />
  );
}

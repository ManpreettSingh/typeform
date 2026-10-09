"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { QuestionRenderer } from "@/components/respondent/QuestionRenderer";
import { RespondentTheme } from "@/components/respondent/RespondentTheme";
import { ThankYouScreen } from "@/components/respondent/ThankYouScreen";
import { canEndAfter } from "@/lib/logic";
import type { AnswerValue, Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { CanvasCheckbox } from "./CanvasCheckbox";
import { CanvasChoices } from "./CanvasChoices";
import { CanvasPictureChoices } from "./CanvasPictureChoices";
import { InlineText } from "./InlineText";

// Mirrors backend limits (schemas/question.py, schemas/form.py).
const QUESTION_TITLE_MAX = 1000;
const DESCRIPTION_MAX = 2000;
const FORM_TITLE_MAX = 200;

export type CanvasDevice = "desktop" | "mobile";

/**
 * The builder canvas: whatever is selected (welcome screen, a question, the ending), drawn by the real respondent
 * components in the form's own theme, with the texts editable in place like Typeform.
 */
export function BuilderCanvas({ device }: { device: CanvasDevice }) {
  const screen = useBuilderStore((s) => s.screen);
  const theme = useBuilderStore((s) => s.form!.theme);
  const questions = useBuilderStore((s) => s.questions);
  const selectedId = useBuilderStore((s) => s.selectedId);
  const index = questions.findIndex((q) => q.id === selectedId);
  const question = questions[index];

  let content: React.ReactNode;
  if (screen === "welcome") content = <CanvasWelcome />;
  else if (screen === "ending") content = <CanvasEnding />;
  else if (question) {
    // Keyed: the try-it-out answer and the autofocus reset when another question is selected.
    content = (
      <CanvasQuestion
        key={question.id}
        question={question}
        number={index + 1}
        isLast={index === questions.length - 1}
        canEnd={canEndAfter(questions, index)}
      />
    );
  } else content = <p className="opacity-60">Add content to start building your form.</p>;

  return (
    <div className="flex min-h-0 flex-1 justify-center">
      <RespondentTheme
        theme={theme}
        className={clsx(
          "flex min-h-0 overflow-y-auto border border-border",
          device === "mobile" ? "my-4 w-[375px] rounded-card shadow-popover" : "w-full",
        )}
      >
        <div className={clsx("m-auto flex w-full justify-center", device === "mobile" ? "px-6 py-10" : "px-10 py-14")}>
          {content}
        </div>
      </RespondentTheme>
    </div>
  );
}

function CanvasQuestion({
  question,
  number,
  isLast,
  canEnd,
}: {
  question: Question;
  number: number;
  isLast: boolean;
  canEnd: boolean;
}) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  // Creators can click around to try the answer; nothing is saved.
  const [value, setValue] = useState<AnswerValue | undefined>();
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // A freshly added question starts untitled: put the cursor straight into its title.
  useEffect(() => {
    if (!question.title) titleRef.current?.focus();
    // Only when this question is first shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QuestionRenderer
      question={question}
      number={number}
      value={value}
      onChange={setValue}
      onSubmit={() => {}}
      mode="preview"
      isLast={isLast}
      canEnd={canEnd}
      titleSlot={
        <div className="flex items-start gap-1 text-xl leading-snug sm:text-[26px] sm:leading-[34px]">
          <InlineText
            ref={titleRef}
            fit
            aria-label="Question"
            placeholder="Your question here."
            value={question.title}
            maxLength={QUESTION_TITLE_MAX}
            onChange={(title) => updateQuestion(question.id, { title })}
          />
          {question.required && <span aria-label="required">*</span>}
        </div>
      }
      descriptionSlot={
        <InlineText
          multiline
          aria-label="Description"
          placeholder="Description (optional)"
          value={question.description ?? ""}
          maxLength={DESCRIPTION_MAX}
          onChange={(description) => updateQuestion(question.id, { description: description || null })}
          className="mt-2 text-base opacity-70 sm:text-lg"
        />
      }
      answerSlot={
        question.type === "multiple_choice" ? (
          <CanvasChoices question={question} />
        ) : question.type === "picture_choice" ? (
          <CanvasPictureChoices question={question} />
        ) : question.type === "checkbox" ? (
          <CanvasCheckbox question={question} />
        ) : undefined
      }
    />
  );
}

function CanvasWelcome() {
  const form = useBuilderStore((s) => s.form!);
  const setTitle = useBuilderStore((s) => s.setTitle);
  const commitTitle = useBuilderStore((s) => s.commitTitle);
  const updateForm = useBuilderStore((s) => s.updateForm);
  const description = form.description ?? "";

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 text-center">
      <InlineText
        aria-label="Welcome title"
        placeholder="Form title"
        value={form.title}
        maxLength={FORM_TITLE_MAX}
        onChange={setTitle}
        onBlur={commitTitle}
        className="text-center text-2xl leading-snug sm:text-3xl"
      />
      <InlineText
        multiline
        aria-label="Welcome description"
        placeholder="Description (optional)"
        value={description}
        maxLength={DESCRIPTION_MAX}
        onChange={(next) => updateForm({ description: next || null })}
        className="text-center text-lg opacity-70"
      />
      
      {(form.welcome?.show_time_to_complete || form.welcome?.show_submission_count) && (
        <div className="flex gap-4 text-sm opacity-60">
          {form.welcome.show_time_to_complete && <span>Takes 5 minutes</span>}
          {form.welcome.show_submission_count && <span>{form.response_count} submissions</span>}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-resp-button bg-resp-accent px-5 py-2.5 text-lg font-semibold text-resp-accent-fg">{form.welcome?.button_text || "Start"}</span>
        <span className="hidden text-xs opacity-60 sm:inline">
          press <strong>Enter ↵</strong>
        </span>
      </div>
      {!description.trim() && (
        <p className="mt-6 max-w-sm text-sm opacity-60">
          Respondents see this welcome screen once it has a description. Without one, the form opens on question 1.
        </p>
      )}
    </div>
  );
}

function CanvasEnding() {
  const form = useBuilderStore((s) => s.form!);
  const selectedEndingId = useBuilderStore((s) => s.selectedEndingId);
  const ending = form.endings.find((e) => e.id === selectedEndingId);

  return <ThankYouScreen thankYou={ending || form.thank_you} interactive={false} />;
}

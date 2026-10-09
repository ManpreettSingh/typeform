"use client";

import { useId, type ComponentType } from "react";
import { ANSWER_COMPONENTS } from "@/components/questionTypes/answers";
import { getDef } from "@/lib/questionTypes";
import type { AnswerValue, PublicQuestion, QuestionType } from "@/lib/types";
import { QuestionShell } from "./QuestionShell";
import type { AnswerProps, RenderMode } from "./types";

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
  /** The form ends after this question with the current answer: OK reads "Submit". */
  isLast?: boolean;
  /**
   * Some answer to this question could end the form (branching). Auto-advance is then off, so a pick never
   * submits by surprise. Defaults to `isLast`.
   */
  canEnd?: boolean;
  submitting?: boolean;
  /** Builder canvas: editable title / description, and a replacement answer area (e.g. inline choice editing). */
  titleSlot?: React.ReactNode;
  descriptionSlot?: React.ReactNode;
  answerSlot?: React.ReactNode;
  /** Builder canvas: what to show for a video question instead of the player (e.g. an "Add video" placeholder). */
  videoSlot?: React.ReactNode;
};

/** A video question's video: the creator asking the question, played with controls (sound on, unlike media videos). */
export function QuestionVideoPlayer({ url, labelledBy }: { url: string; labelledBy?: string }) {
  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      aria-labelledby={labelledBy}
      className="aspect-video max-h-[45vh] w-full rounded-resp-button bg-black object-contain"
    />
  );
}

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
  canEnd = isLast,
  submitting,
  titleSlot,
  descriptionSlot,
  answerSlot,
  videoSlot,
}: QuestionRendererProps) {
  const titleId = useId();
  const { video_question: isVideoQuestion, video } = question.properties;
  const videoBlock = isVideoQuestion
    ? (videoSlot ?? (video ? <QuestionVideoPlayer url={video.url} labelledBy={titleId} /> : null))
    : null;
  const live = mode === "live";
  const common = { onSubmit, live, autoAdvance: live && !isLast && !canEnd, labelledBy: titleId };

  // One lookup instead of a switch: the registry (components/questionTypes/answers.ts) guarantees every type has a component.
  const Answer = ANSWER_COMPONENTS[question.type] as unknown as ComponentType<AnswerProps<QuestionType>>;
  const answer = <Answer {...common} question={question} value={value} onChange={onChange} />;

  return (
    <QuestionShell
      number={number}
      title={question.title}
      titleId={titleId}
      groupTitle={question.group_title}
      description={question.description}
      required={question.required || Boolean(getDef(question.type).alwaysRequired)}
      error={error}
      errorKey={errorKey}
      submitLabel={isLast ? "Submit" : "OK"}
      submitting={submitting}
      onSubmit={onSubmit}
      titleSlot={titleSlot}
      descriptionSlot={descriptionSlot}
      video={videoBlock}
      hint={
        question.type === "long_text" ? (
          <>
            <strong>Shift ⇧ + Enter ↵</strong> to make a line break
          </>
        ) : undefined
      }
    >
      {answerSlot ?? answer}
    </QuestionShell>
  );
}

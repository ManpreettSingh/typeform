import type { AnswerValueMap, PublicQuestionOf, QuestionType } from "@/lib/types";

export type RenderMode = "preview" | "live";

/** Props shared by every per-type answer component. All are controlled. */
export type AnswerProps<T extends QuestionType> = {
  question: PublicQuestionOf<T>;
  value: AnswerValueMap[T] | undefined;
  onChange: (value: AnswerValueMap[T] | undefined) => void;
  /** OK / Enter. For single-select types this also fires after a pick when `autoAdvance` is on. */
  onSubmit: () => void;
  /** Live: autofocus and keyboard shortcuts. Preview (builder canvas): neither. */
  live: boolean;
  /** Advance right after a single-select pick. Off in preview and on the last question (no surprise submit). */
  autoAdvance: boolean;
  /** id of the question title, for aria-labelledby. */
  labelledBy: string;
};

/** Delay before auto-advancing after a single-select pick, so the selection is visible. */
export const AUTO_ADVANCE_MS = 400;

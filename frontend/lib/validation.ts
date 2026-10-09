// Client-side answer validation. Mirrors the server rules in docs/API_SPEC.md; the server stays authoritative.
import { isEmptyAnswer } from "@/lib/answerEmpty";
import { resolve, type ResolveForm } from "@/lib/logic";
import { getDef } from "@/lib/questionTypes";
import type { AnswerValue, Answers, PublicQuestion, SubmissionIn } from "@/lib/types";

export { isEmptyAnswer };

/** Returns an error message, or null when the answer is acceptable. */
export function validateAnswer(question: PublicQuestion, value: AnswerValue | undefined): string | null {
  const def = getDef(question.type);
  const unanswered = question.required ? (def.requiredMessage ?? "Please fill this in") : null;
  if (value === undefined || isEmptyAnswer(value)) return unanswered;
  const error = def.validate(question, value);
  if (error) return error;
  // A valid answer can still fall short of a required question (declining a required legal notice).
  return def.satisfiesRequired && !def.satisfiesRequired(value) ? unanswered : null;
}

/** What the path depends on besides the questions: endings, variable definitions and the URL parameters received. */
export type SubmissionContext = Pick<ResolveForm, "endings" | "variables"> & { params?: Record<string, string> };

/**
 * Request body for a submission: only questions on the respondent's path (branching), empty answers dropped,
 * text trimmed, numbers as numbers; the declared URL parameters received, when there are any.
 */
export function toSubmission(
  questions: PublicQuestion[],
  answers: Answers,
  { endings, variables, params }: SubmissionContext = {},
): SubmissionIn {
  const out: SubmissionIn["answers"] = {};
  const { path } = resolve({ questions, endings, variables }, answers, params);
  for (const id of path) {
    const question = questions.find((q) => q.id === id)!;
    const value = answers[id];
    if (value === undefined || isEmptyAnswer(value)) continue;
    out[id] = getDef(question.type).toSubmission(question, value);
  }
  return params && Object.keys(params).length > 0 ? { answers: out, params } : { answers: out };
}

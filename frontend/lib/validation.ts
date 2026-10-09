// Client-side answer validation. Mirrors the server rules in docs/API_SPEC.md; the server stays authoritative.
import { visitedPath } from "@/lib/logic";
import { getDef } from "@/lib/questionTypes";
import type { AnswerValue, Answers, PublicQuestion, SubmissionIn } from "@/lib/types";

export function isEmptyAnswer(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

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

/**
 * Request body for a submission: only questions on the respondent's path (branching), empty answers dropped,
 * text trimmed, numbers as numbers.
 */
export function toSubmission(questions: PublicQuestion[], answers: Answers): SubmissionIn {
  const out: SubmissionIn["answers"] = {};
  for (const question of visitedPath(questions, answers).map((i) => questions[i])) {
    const value = answers[question.id];
    if (value === undefined || isEmptyAnswer(value)) continue;
    out[question.id] = getDef(question.type).toSubmission(question, value);
  }
  return { answers: out };
}

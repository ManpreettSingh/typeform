import type { PublicQuestion } from "@/lib/types";

/**
 * What a respondent is actually asked: Partial Submit Points are never shown. The question before each point is
 * marked `partial_submit_after`, so moving past it tells the server the response now counts as submitted.
 * The given questions are not changed.
 */
export function toRespondentQuestions(questions: PublicQuestion[]): PublicQuestion[] {
  const shown: PublicQuestion[] = [];
  for (const q of questions) {
    if (q.type !== "partial_submit") shown.push(q);
    else if (shown.length > 0) shown[shown.length - 1] = { ...shown[shown.length - 1], partial_submit_after: true };
  }
  return shown;
}

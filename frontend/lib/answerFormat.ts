// Display text for stored answers (results table, response drawer). Mirrors backend services/export.py.
import { formatNumber, getDef } from "@/lib/questionTypes";
import type { AnswerValue, PublicQuestion } from "@/lib/types";

export { formatNumber };

export function formatAnswer(question: PublicQuestion, value: AnswerValue | undefined): string {
  if (value === undefined || value === null) return "";
  return getDef(question.type).format(question, value);
}

import type { AnswerValue } from "@/lib/types";

/** Whether an answer counts as "not answered": missing, blank text or an empty list. `false` and `0` are answers. */
export function isEmptyAnswer(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

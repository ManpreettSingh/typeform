// Branching: which question comes next. Mirrors backend/app/services/logic.py (the server is authoritative).
//
// Only forward jumps are followed: a rule whose target is missing or not after the current question is
// skipped, so every path is finite (no cycles) even after questions are reordered.
import type { AnswerValue, Answers, LogicOp, LogicRule, PublicQuestion, QuestionType } from "@/lib/types";
import { isEmptyAnswer } from "@/lib/validation";

const CHOICE_OPS: LogicOp[] = ["is", "is_not"];
const NUMBER_OPS: LogicOp[] = ["eq", "neq", "lt", "lte", "gt", "gte"];
const TEXT_OPS: LogicOp[] = ["is", "is_not", "contains"];

/** Conditions available per question type, in menu order (matches OPS_BY_TYPE on the server). */
export const OPS_BY_TYPE: Record<QuestionType, LogicOp[]> = {
  multiple_choice: CHOICE_OPS,
  dropdown: CHOICE_OPS,
  yes_no: ["is"],
  number: NUMBER_OPS,
  rating: NUMBER_OPS,
  short_text: TEXT_OPS,
  long_text: TEXT_OPS,
  email: TEXT_OPS,
};

export const OP_LABELS: Record<LogicOp, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  eq: "is equal to",
  neq: "is not equal to",
  lt: "is less than",
  lte: "is at most",
  gt: "is greater than",
  gte: "is at least",
};

function toNumber(value: unknown): number | null {
  if (typeof value === "boolean") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** Whether `rule` applies to `value`. Unanswered questions match no rule. */
export function ruleMatches(type: QuestionType, rule: LogicRule, value: AnswerValue | undefined): boolean {
  if (value === undefined || isEmptyAnswer(value)) return false;
  const { op, value: expected } = rule;

  switch (type) {
    case "multiple_choice":
    case "dropdown": {
      const picked = Array.isArray(value) ? value : [value];
      return picked.includes(expected as string) === (op === "is");
    }
    case "yes_no":
      return value === expected;
    case "number":
    case "rating": {
      const a = toNumber(value);
      const b = toNumber(expected);
      if (a === null || b === null) return false;
      const results: Partial<Record<LogicOp, boolean>> = {
        eq: a === b,
        neq: a !== b,
        lt: a < b,
        lte: a <= b,
        gt: a > b,
        gte: a >= b,
      };
      return results[op] ?? false;
    }
    default: {
      const a = String(value).trim().toLowerCase();
      const b = String(expected).trim().toLowerCase();
      const results: Partial<Record<LogicOp, boolean>> = { is: a === b, is_not: a !== b, contains: a.includes(b) };
      return results[op] ?? false;
    }
  }
}

/** Index of the question after `questions[index]` given `answers`, or null for the end of the form. */
export function nextIndex(questions: PublicQuestion[], index: number, answers: Answers): number | null {
  const question = questions[index];
  for (const rule of question.logic?.rules ?? []) {
    if (!ruleMatches(question.type, rule, answers[question.id])) continue;
    if (rule.to === "end") return null;
    const target = questions.findIndex((q) => q.id === rule.to);
    if (target > index) return target;
  }
  return index + 1 < questions.length ? index + 1 : null;
}

/** Indices a respondent with these answers goes through, from the first question to the end. */
export function visitedPath(questions: PublicQuestion[], answers: Answers): number[] {
  const path: number[] = [];
  let index: number | null = questions.length ? 0 : null;
  while (index !== null) {
    path.push(index);
    index = nextIndex(questions, index, answers);
  }
  return path;
}

/** Whether answering this question can finish the form (it's last, or a rule jumps to the end). */
export function canEndAfter(questions: PublicQuestion[], index: number): boolean {
  return index === questions.length - 1 || Boolean(questions[index]?.logic?.rules.some((r) => r.to === "end"));
}

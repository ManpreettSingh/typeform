// Branching: which question comes next. Mirrors backend/app/services/logic.py (the server is authoritative).
//
// Only forward jumps are followed: a rule whose target is missing or not after the current question is
// skipped, so every path is finite (no cycles) even after questions are reordered.
import { QUESTION_TYPE_DEFS, getDef } from "@/lib/questionTypes";
import { QUESTION_TYPES } from "@/lib/types";
import type { AnswerValue, Answers, LogicOp, LogicRule, PublicQuestion, QuestionType } from "@/lib/types";
import { isEmptyAnswer } from "@/lib/validation";

/** Conditions available per question type, in menu order (matches the server's `logic_ops`). */
export const OPS_BY_TYPE = Object.fromEntries(
  QUESTION_TYPES.map((type) => [type, QUESTION_TYPE_DEFS[type].ops]),
) as Record<QuestionType, LogicOp[]>;

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

/** Whether `rule` applies to `value`. Unanswered questions match no rule. */
export function ruleMatches(type: QuestionType, rule: LogicRule, value: AnswerValue | undefined): boolean {
  if (value === undefined || isEmptyAnswer(value)) return false;
  return getDef(type).ruleMatches(rule, value);
}

/** The wording of a condition for a question type (dates say "is before", numbers "is less than"). */
export function opLabel(type: QuestionType, op: LogicOp): string {
  return QUESTION_TYPE_DEFS[type].opLabels?.[op] ?? OP_LABELS[op];
}

/** Index of the question after `questions[index]` given `answers`, or null for the end of the form. */
export function nextIndex(questions: PublicQuestion[], index: number, answers: Answers): number | null {
  const question = questions[index];
  for (const rule of question.logic?.rules ?? []) {
    if (!ruleMatches(question.type, rule, answers[question.id])) continue;
    if (rule.to === "end") return null;
    const target = questions.findIndex((q) => q.id === rule.to);
    if (target > index) {
      if (questions[target].type === "group") {
        const targetId = questions[target].id;
        const children = [];
        for (let i = target + 1; i < questions.length; i++) {
          if (questions[i].group_id === targetId) {
            children.push(i);
          }
        }
        if (children.length > 0) return children[0];
      }
      return target;
    }
  }

  let nxt = index + 1;
  while (nxt < questions.length) {
    if (questions[nxt].type === "group") {
      const nxtId = questions[nxt].id;
      let hasChildren = false;
      for (let i = nxt + 1; i < questions.length; i++) {
        if (questions[i].group_id === nxtId) {
          hasChildren = true;
          break;
        }
      }
      if (!hasChildren) {
        nxt++;
        continue;
      }
    }
    return nxt;
  }
  return null;
}

/** Indices a respondent with these answers goes through, from the first question to the end. */
export function visitedPath(questions: PublicQuestion[], answers: Answers): number[] {
  const path: number[] = [];

  function skipEmpty(nxt: number): number | null {
    while (nxt < questions.length) {
      if (questions[nxt].type === "group") {
        const nxtId = questions[nxt].id;
        let hasChildren = false;
        for (let i = nxt + 1; i < questions.length; i++) {
          if (questions[i].group_id === nxtId) {
            hasChildren = true;
            break;
          }
        }
        if (!hasChildren) {
          nxt++;
          continue;
        }
      }
      return nxt;
    }
    return null;
  }

  let index: number | null = questions.length ? skipEmpty(0) : null;
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

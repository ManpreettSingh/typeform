// Logic v2 resolver: the path a respondent takes, the variables, and the ending. Mirrors backend/app/services/logic.py
// (the server is authoritative); both run the same golden cases (backend/tests/fixtures/logic_cases.json).
//
// docs/superpowers/specs/2026-10-09-phase3-logic-design.md section 4.1, without the deferred hide steps.
//
// Only forward jumps are followed, so every path is finite even after questions are reordered.
import { isEmptyAnswer } from "@/lib/answerEmpty";
import { QUESTION_TYPE_DEFS, getDef, type LogicRule } from "@/lib/questionTypes";
import { QUESTION_TYPES } from "@/lib/types";
import type {
  AnswerValue,
  Answers,
  CalcRule,
  Condition,
  ConditionSet,
  Ending,
  FormVariable,
  Logic,
  LogicOp,
  LogicTarget,
  QuestionType,
  VariableValues,
} from "@/lib/types";

/** Conditions available per question type, in menu order (matches the server's `logic_ops`). */
export const OPS_BY_TYPE = Object.fromEntries(
  QUESTION_TYPES.map((type) => [type, QUESTION_TYPE_DEFS[type].ops]),
) as Record<QuestionType, LogicOp[]>;

/** Conditions offered for a number variable, and for a text variable or URL parameter (both read as text). */
export const NUMBER_VARIABLE_OPS: LogicOp[] = ["eq", "neq", "lt", "lte", "gt", "gte"];
export const TEXT_SOURCE_OPS: LogicOp[] = ["is", "is_not", "contains"];

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

// ---- the resolver -----------------------------------------------------------

/** The part of a question the resolver reads; a `PublicQuestion` or a plain fixture object both fit. */
export type ResolveQuestion = {
  id: number;
  type: QuestionType;
  group_id?: number | null;
  logic?: Logic | null;
};
export type ResolveEnding = Pick<Ending, "id"> & { position?: number; outcome?: Ending["outcome"] };
/** Everything `resolve` needs from a form: questions in order, endings and the variable definitions. */
export type ResolveForm = {
  questions: ResolveQuestion[];
  endings?: ResolveEnding[];
  variables?: FormVariable[];
};

export type ResolvedEnding = { id: number } | { default: true };

export type Resolution = {
  /** Ids of the screens the respondent goes through, first to last (group header rows included). */
  path: number[];
  /** Final variable values (after every calculation on the path). */
  variables: VariableValues;
  /** The ending reached: a specific ending, or the built-in Default end. */
  ending: ResolvedEnding;
  /** Variable values when `questionId` is shown (calculations of earlier questions applied, its own not yet). */
  variablesAt(questionId: number): VariableValues;
  /** The id of the screen after `questionId`, or null when answering it finishes the form (or it is off the path). */
  nextAfter(questionId: number): number | null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "boolean" || value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
};

const normalize = (value: unknown): string => String(value).trim().toLowerCase();

function compareNumbers(op: LogicOp, actual: number, expected: unknown): boolean {
  const b = toNumber(expected);
  if (b === null) return false;
  const results: Partial<Record<LogicOp, boolean>> = {
    eq: actual === b,
    neq: actual !== b,
    lt: actual < b,
    lte: actual <= b,
    gt: actual > b,
    gte: actual >= b,
  };
  return results[op] ?? false;
}

function compareText(op: LogicOp, actual: string, expected: unknown): boolean {
  const a = normalize(actual);
  const b = normalize(expected);
  const results: Partial<Record<LogicOp, boolean>> = { is: a === b, is_not: a !== b, contains: a.includes(b) };
  return results[op] ?? false;
}

/** Applies one calculation to `values` in place. Divide by zero, missing or text variables leave it unchanged. */
function applyCalc(rule: CalcRule, values: VariableValues): void {
  const current = values[rule.variable];
  if (typeof current !== "number") return;
  const operand = "number" in rule.value ? rule.value.number : values[rule.value.variable];
  if (typeof operand !== "number" || !Number.isFinite(operand)) return;
  switch (rule.op) {
    case "add":
      values[rule.variable] = current + operand;
      break;
    case "subtract":
      values[rule.variable] = current - operand;
      break;
    case "multiply":
      values[rule.variable] = current * operand;
      break;
    case "divide":
      if (operand !== 0) values[rule.variable] = current / operand;
      break;
  }
}

type Outcome = { next: number | null; finish: ResolvedEnding | null };

/**
 * Walks the form with these answers and URL parameters. `answers` of questions that are not on the path are ignored;
 * a condition can only read the current question and the ones already visited.
 */
export function resolve(form: ResolveForm, answers: Answers, params: Record<string, string> = {}): Resolution {
  const questions = form.questions;
  const endings = [...(form.endings ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const values: VariableValues = {};
  for (const variable of form.variables ?? []) {
    values[variable.name] = variable.type === "number" ? (toNumber(variable.initial) ?? 0) : String(variable.initial);
  }

  const indexById = new Map(questions.map((q, i) => [q.id, i]));
  const hasChildren = (header: number) =>
    questions.some((q, i) => i > header && q.group_id === questions[header].id);
  /** The first index at or after `from` that is shown: a group header with no children is skipped. */
  const firstShown = (from: number): number | null => {
    for (let i = from; i < questions.length; i++) {
      if (questions[i].type !== "group" || hasChildren(i)) return i;
    }
    return null;
  };

  const visited = new Set<number>();
  const path: number[] = [];
  const snapshots = new Map<number, VariableValues>();
  let finish: ResolvedEnding | null = null;

  const holds = (condition: Condition): boolean => {
    const { source } = condition;
    if ("question" in source) {
      const index = indexById.get(source.question);
      // Questions skipped or not reached yet have no answer for the rules.
      if (index === undefined || !visited.has(source.question)) return false;
      return ruleMatches(questions[index].type, condition, answers[source.question]);
    }
    if ("variable" in source) {
      const value = values[source.variable];
      if (typeof value === "number") return compareNumbers(condition.op, value, condition.value);
      return typeof value === "string" && compareText(condition.op, value, condition.value);
    }
    const value = params[source.param];
    return typeof value === "string" && compareText(condition.op, value, condition.value);
  };
  const matches = (set: ConditionSet): boolean => {
    if (set.conditions.length === 0) return false; // never unconditional
    return set.match === "any" ? set.conditions.some(holds) : set.conditions.every(holds);
  };

  /** Where a branch target leads from question `from`; null when the target is unusable (ignored). */
  const follow = (target: LogicTarget, from: number): Outcome | null => {
    if ("question" in target) {
      const at = indexById.get(target.question);
      if (at === undefined || at <= from) return null;
      if (questions[at].type !== "group") return { next: at, finish: null };
      // A jump aimed at a group header lands on its first child; an empty group is passed over.
      const child = questions.findIndex((q, i) => i > at && q.group_id === questions[at].id);
      return { next: child !== -1 ? child : firstShown(at + 1), finish: null };
    }
    if ("ending" in target) {
      return endings.some((e) => e.id === target.ending) ? { next: null, finish: { id: target.ending } } : null;
    }
    return { next: null, finish: { default: true } };
  };

  let index = firstShown(0);
  while (index !== null) {
    const question = questions[index];
    path.push(question.id);
    visited.add(question.id);
    snapshots.set(question.id, { ...values });

    const logic = question.logic;
    let outcome: Outcome | null = null;
    if (logic) {
      for (const rule of logic.calc ?? []) if (matches(rule.when)) applyCalc(rule, values);
      for (const rule of logic.branch?.rules ?? []) {
        if (matches(rule.when)) outcome = follow(rule.to, index);
        if (outcome) break;
      }
      if (!outcome && logic.branch?.otherwise) outcome = follow(logic.branch.otherwise, index);
    }
    outcome ??= { next: firstShown(index + 1), finish: null };
    finish = outcome.finish;
    index = outcome.next;
  }

  return {
    path,
    variables: { ...values },
    ending: finish ?? quizEnding(endings, visited, answers),
    variablesAt: (questionId) => ({ ...(snapshots.get(questionId) ?? values) }),
    nextAfter: (questionId) => {
      const at = path.indexOf(questionId);
      return at === -1 ? null : (path[at + 1] ?? null);
    },
  };
}

/**
 * The ending when no rule picked one: the outcome quiz winner (one point per picked answer on the path, ties go to the
 * earliest ending), which is also the first ending when nobody scored; the built-in Default end without endings.
 */
function quizEnding(endings: ResolveEnding[], visited: Set<number>, answers: Answers): ResolvedEnding {
  if (endings.length === 0) return { default: true };
  const points = (ending: ResolveEnding) =>
    (ending.outcome ?? []).filter(({ question, choice }) => {
      if (!visited.has(question)) return false;
      const picked = answers[question];
      return Array.isArray(picked) ? (picked as unknown[]).includes(choice) : picked === choice;
    }).length;
  let best = endings[0];
  let bestPoints = points(best);
  for (const ending of endings.slice(1)) {
    const score = points(ending);
    if (score > bestPoints) [best, bestPoints] = [ending, score];
  }
  return { id: best.id };
}

/**
 * Whether answering `questions[index]` could finish the form: it is the last one, or some rule can jump to an
 * ending. The respondent then never auto-advances on a pick, so a click can't submit by surprise.
 */
export function canEndAfter(questions: ResolveQuestion[], index: number): boolean {
  if (index === questions.length - 1) return true;
  const branch = questions[index]?.logic?.branch;
  if (!branch) return false;
  const finishes = (target: LogicTarget | null) => Boolean(target && ("ending" in target || "end" in target));
  return branch.rules.some((rule) => finishes(rule.to)) || finishes(branch.otherwise);
}

// Score quiz: a view over calculation rules of one exact shape (spec 2026-10-09-phase3-logic-design.md section 6.1).
//
//   { op: "add", value: { number: N }, variable: "score",
//     when: { match: "all", conditions: [ { source: { question: Q }, op: "is", value: <choice id> } ] } }
//
// The Score quiz dialog reads and writes these rules and nothing else; every other calculation is left alone.
import type { CalcRule, Logic, PublicQuestion } from "@/lib/types";

export const SCORE_VARIABLE = "score";
/** |points| may not exceed this (the server rejects more). */
export const SCORE_LIMIT = 1_000_000;

/** Points per choice id, per question id. Missing or 0 means "no rule". */
export type ScoreTable = Record<number, Record<string, number>>;

const CHOICE_TYPES = new Set<string>(["multiple_choice", "dropdown", "picture_choice"]);

type ChoiceQuestion = Extract<PublicQuestion, { type: "multiple_choice" | "dropdown" | "picture_choice" }>;

export const isScoreChoiceQuestion = (q: PublicQuestion): q is ChoiceQuestion => CHOICE_TYPES.has(q.type);

/** Every question the Score quiz covers: choice-type questions (multiple choice, dropdown, picture choice). */
export const scoreChoiceQuestions = <Q extends PublicQuestion>(questions: Q[]): Extract<Q, ChoiceQuestion>[] =>
  questions.filter(isScoreChoiceQuestion) as Extract<Q, ChoiceQuestion>[];

/** The rule "add `points` to score when the answer to `questionId` is `choiceId`". */
export function scoreRule(questionId: number, choiceId: string, points: number): CalcRule {
  return {
    op: "add",
    value: { number: points },
    variable: SCORE_VARIABLE,
    when: { match: "all", conditions: [{ source: { question: questionId }, op: "is", value: choiceId }] },
  };
}

/** The choice a score rule is about, or null when `rule` is not of the score shape on question `questionId`. */
function scoreRuleChoice(rule: CalcRule, questionId: number): string | null {
  if (rule.op !== "add" || rule.variable !== SCORE_VARIABLE || !("number" in rule.value)) return null;
  if (rule.when.match !== "all" || rule.when.conditions.length !== 1) return null;
  const [condition] = rule.when.conditions;
  if (condition.op !== "is" || typeof condition.value !== "string") return null;
  if (!("question" in condition.source) || condition.source.question !== questionId) return null;
  return condition.value;
}

export const isScoreRule = (rule: CalcRule, questionId: number): boolean => scoreRuleChoice(rule, questionId) !== null;

/** Points per choice as the rules say them; choices without a score rule are absent. */
export function toScoreTable(questions: PublicQuestion[]): ScoreTable {
  const table: ScoreTable = {};
  for (const q of scoreChoiceQuestions(questions)) {
    const ids = new Set(q.properties.options.map((o) => o.id));
    const points: Record<string, number> = {};
    for (const rule of q.logic?.calc ?? []) {
      const choice = scoreRuleChoice(rule, q.id);
      if (choice === null || !ids.has(choice) || !("number" in rule.value)) continue;
      // Duplicates (not made by the dialog) add up, which is what the respondent would get.
      points[choice] = (points[choice] ?? 0) + rule.value.number;
    }
    table[q.id] = points;
  }
  return table;
}

/** A Logic value with these lists, or null when it would be empty (the server stores null then). */
export function logicOrNull(branch: Logic["branch"], calc: CalcRule[]): Logic | null {
  if (branch.rules.length === 0 && branch.otherwise === null && calc.length === 0) return null;
  return { version: 2, branch, calc };
}

function withCalc<Q extends PublicQuestion>(question: Q, calc: CalcRule[]): Q {
  const branch = question.logic?.branch ?? { rules: [], otherwise: null };
  return { ...question, logic: logicOrNull(branch, calc) };
}

/**
 * Writes `table` into the questions it names (the table is authoritative for those questions: a choice with 0, no
 * entry or a non-finite value gets no rule). Questions not in the table are returned as they are, and so are
 * questions whose rules already match. Other calculations and all branching are untouched; score rules that change
 * are rewritten where they stand, new ones are appended in choice order.
 */
export function applyScoreTable<Q extends PublicQuestion>(questions: Q[], table: ScoreTable): Q[] {
  return questions.map((q) => {
    const wanted = table[q.id];
    if (!wanted || !isScoreChoiceQuestion(q)) return q;
    const choiceIds = q.properties.options.map((o) => o.id);
    const points = (id: string) => {
      const n = wanted[id];
      return typeof n === "number" && Number.isFinite(n) && n !== 0 ? n : 0;
    };

    const existing = q.logic?.calc ?? [];
    const written = new Set<string>();
    const next: CalcRule[] = [];
    for (const rule of existing) {
      const choice = scoreRuleChoice(rule, q.id);
      if (choice === null) {
        next.push(rule);
        continue;
      }
      const n = choiceIds.includes(choice) ? points(choice) : 0;
      if (n === 0 || written.has(choice)) continue; // removed, or a duplicate of a rule already written
      written.add(choice);
      next.push("number" in rule.value && rule.value.number === n ? rule : scoreRule(q.id, choice, n));
    }
    for (const id of choiceIds) {
      if (!written.has(id) && points(id) !== 0) next.push(scoreRule(q.id, id, points(id)));
    }

    const unchanged = next.length === existing.length && next.every((rule, i) => rule === existing[i]);
    return unchanged ? q : withCalc(q, next);
  });
}

/** "Delete all rules": removes every score-shaped rule in the form and leaves other calculations alone. */
export function clearScoreRules<Q extends PublicQuestion>(questions: Q[]): Q[] {
  return questions.map((q) => {
    const calc = q.logic?.calc;
    if (!calc?.length) return q;
    const kept = calc.filter((rule) => !isScoreRule(rule, q.id));
    return kept.length === calc.length ? q : withCalc(q, kept);
  });
}

/** Reads a "Score" input: blank is 0 (no rule); decimals and negatives are fine up to SCORE_LIMIT. */
export function parseScoreInput(text: string): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { value: 0 };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { error: "Enter a number" };
  if (Math.abs(n) > SCORE_LIMIT) return { error: "Use a number between -1,000,000 and 1,000,000" };
  return { value: n };
}

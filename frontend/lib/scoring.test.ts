import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { options, question } from "./__fixtures__/questions";
import {
  SCORE_LIMIT,
  applyScoreTable,
  clearScoreRules,
  isScoreRule,
  parseScoreInput,
  scoreChoiceQuestions,
  scoreRule,
  toScoreTable,
} from "./scoring";
import type { CalcRule, Logic, PublicQuestion } from "./types";

const choiceProps = (labels: string[]) => ({
  options: options(...labels),
  allow_multiple: false,
  allow_other: false,
  none_of_the_above: false,
  randomize: false,
});

const logicOf = (calc: CalcRule[], extra: Partial<Logic["branch"]> = {}): Logic => ({
  version: 2,
  branch: { rules: [], otherwise: null, ...extra },
  calc,
});

const calcOf = (q: PublicQuestion): CalcRule[] => q.logic?.calc ?? [];

describe("scoreChoiceQuestions", () => {
  it("lists multiple choice, dropdown and picture choice only", () => {
    const mc = question("multiple_choice", choiceProps(["A", "B"]));
    const dd = question("dropdown", { options: options("A"), alphabetical: false, randomize: false });
    const pc = question("picture_choice", { ...choiceProps(["A"]), show_labels: true, supersized: false });
    const yn = question("yes_no");
    const txt = question("short_text");
    assert.deepEqual(
      scoreChoiceQuestions([txt, mc, yn, dd, pc]).map((q) => q.id),
      [mc.id, dd.id, pc.id],
    );
  });
});

describe("isScoreRule / scoreRule", () => {
  it("recognises exactly the shape of spec 6.1", () => {
    const q = question("multiple_choice", choiceProps(["A", "B"]));
    const rule = scoreRule(q.id, "a", 3);
    assert.deepEqual(rule, {
      op: "add",
      value: { number: 3 },
      variable: "score",
      when: { match: "all", conditions: [{ source: { question: q.id }, op: "is", value: "a" }] },
    });
    assert.equal(isScoreRule(rule, q.id), true);
  });

  it("rejects every other shape", () => {
    const q = question("multiple_choice", choiceProps(["A", "B"]));
    const base = scoreRule(q.id, "a", 3);
    const variants: CalcRule[] = [
      { ...base, op: "subtract" },
      { ...base, variable: "other" },
      { ...base, value: { variable: "score" } },
      { ...base, when: { ...base.when, match: "any" } },
      { ...base, when: { match: "all", conditions: [{ source: { question: q.id + 1 }, op: "is", value: "a" }] } },
      { ...base, when: { match: "all", conditions: [{ source: { variable: "score" }, op: "gt", value: 1 }] } },
      { ...base, when: { match: "all", conditions: [{ source: { question: q.id }, op: "is_not", value: "a" }] } },
      { ...base, when: { match: "all", conditions: [{ ...base.when.conditions[0] }, { ...base.when.conditions[0] }] } },
      { ...base, when: { match: "all", conditions: [{ source: { question: q.id }, op: "is", value: 5 }] } },
    ];
    for (const rule of variants) assert.equal(isScoreRule(rule, q.id), false, JSON.stringify(rule));
  });
});

describe("toScoreTable", () => {
  it("reads points per choice and ignores other calculations", () => {
    const q = question("multiple_choice", choiceProps(["A", "B", "C"]));
    q.logic = logicOf([
      scoreRule(q.id, "a", 2),
      scoreRule(q.id, "c", -1.5),
      { op: "multiply", value: { number: 2 }, variable: "score", when: scoreRule(q.id, "b", 1).when },
    ]);
    const plain = question("dropdown", { options: options("X"), alphabetical: false, randomize: false });
    assert.deepEqual(toScoreTable([q, plain]), { [q.id]: { a: 2, c: -1.5 }, [plain.id]: {} });
  });

  it("ignores score rules that name a removed choice", () => {
    const q = question("multiple_choice", choiceProps(["A"]));
    q.logic = logicOf([scoreRule(q.id, "zzz", 4)]);
    assert.deepEqual(toScoreTable([q]), { [q.id]: {} });
  });
});

describe("applyScoreTable", () => {
  it("adds rules in choice order and creates version-2 logic", () => {
    const q = question("multiple_choice", choiceProps(["A", "B", "C"]));
    const [next] = applyScoreTable([q], { [q.id]: { c: 1, a: 5 } });
    assert.equal(next.logic?.version, 2);
    assert.deepEqual(next.logic?.branch, { rules: [], otherwise: null });
    assert.deepEqual(calcOf(next), [scoreRule(q.id, "a", 5), scoreRule(q.id, "c", 1)]);
  });

  it("treats 0, missing and non-finite points as no rule, and nulls empty logic", () => {
    const q = question("multiple_choice", choiceProps(["A", "B", "C"]));
    q.logic = logicOf([scoreRule(q.id, "a", 2), scoreRule(q.id, "b", 3)]);
    const [a] = applyScoreTable([q], { [q.id]: { a: 0, b: 3 } });
    assert.deepEqual(calcOf(a), [scoreRule(q.id, "b", 3)]);
    const [b] = applyScoreTable([q], { [q.id]: { a: 0, b: Number.NaN } });
    assert.equal(b.logic, null);
    const [c] = applyScoreTable([q], { [q.id]: {} });
    assert.equal(c.logic, null);
  });

  it("keeps other calculations and branching untouched, rewriting score rules in place", () => {
    const q = question("multiple_choice", choiceProps(["A", "B"]));
    const other: CalcRule = {
      op: "add",
      value: { number: 10 },
      variable: "score",
      when: { match: "any", conditions: [{ source: { question: q.id }, op: "is", value: "a" }] },
    };
    const branch = { rules: [{ to: { end: true as const }, when: other.when }], otherwise: null };
    q.logic = logicOf([scoreRule(q.id, "a", 1), other, scoreRule(q.id, "b", 2)], branch);
    const [next] = applyScoreTable([q], { [q.id]: { a: 7, b: 2 } });
    assert.deepEqual(calcOf(next), [scoreRule(q.id, "a", 7), other, scoreRule(q.id, "b", 2)]);
    assert.deepEqual(next.logic?.branch, branch);
    // The untouched rule keeps its identity.
    assert.equal(calcOf(next)[1], other);
    assert.equal(calcOf(next)[2], q.logic!.calc[2]);
  });

  it("returns the same question objects when nothing changes, and skips questions missing from the table", () => {
    const q = question("multiple_choice", choiceProps(["A", "B"]));
    q.logic = logicOf([scoreRule(q.id, "a", 1)]);
    const other = question("multiple_choice", choiceProps(["A"]));
    other.logic = logicOf([scoreRule(other.id, "a", 9)]);
    const [x, y] = applyScoreTable([q, other], { [q.id]: { a: 1 } });
    assert.equal(x, q);
    assert.equal(y, other);
  });

  it("collapses duplicate score rules for one choice", () => {
    const q = question("multiple_choice", choiceProps(["A"]));
    q.logic = logicOf([scoreRule(q.id, "a", 1), scoreRule(q.id, "a", 2)]);
    const [next] = applyScoreTable([q], { [q.id]: { a: 4 } });
    assert.deepEqual(calcOf(next), [scoreRule(q.id, "a", 4)]);
  });

  it("ignores choices that do not exist and questions that are not choice questions", () => {
    const q = question("multiple_choice", choiceProps(["A"]));
    const t = question("short_text");
    const [a, b] = applyScoreTable([q, t], { [q.id]: { zzz: 3 }, [t.id]: { a: 1 } });
    assert.equal(a, q);
    assert.equal(b, t);
  });
});

describe("clearScoreRules", () => {
  it("removes only score-shaped rules", () => {
    const q = question("multiple_choice", choiceProps(["A", "B"]));
    const other: CalcRule = { op: "subtract", value: { number: 1 }, variable: "score", when: scoreRule(q.id, "a", 1).when };
    q.logic = logicOf([scoreRule(q.id, "a", 1), other]);
    const onlyScore = question("multiple_choice", choiceProps(["A"]));
    onlyScore.logic = logicOf([scoreRule(onlyScore.id, "a", 1)]);
    const untouched = question("short_text");
    const [a, b, c] = clearScoreRules([q, onlyScore, untouched]);
    assert.deepEqual(calcOf(a), [other]);
    assert.equal(b.logic, null);
    assert.equal(c, untouched);
  });
});

describe("parseScoreInput", () => {
  it("accepts blank as zero, decimals and negatives", () => {
    assert.deepEqual(parseScoreInput(""), { value: 0 });
    assert.deepEqual(parseScoreInput("  "), { value: 0 });
    assert.deepEqual(parseScoreInput("2.5"), { value: 2.5 });
    assert.deepEqual(parseScoreInput("-3"), { value: -3 });
  });

  it("rejects text and out-of-range numbers", () => {
    assert.ok("error" in parseScoreInput("abc"));
    assert.ok("error" in parseScoreInput("-"));
    assert.ok("error" in parseScoreInput(String(SCORE_LIMIT + 1)));
    assert.deepEqual(parseScoreInput(String(SCORE_LIMIT)), { value: SCORE_LIMIT });
  });
});

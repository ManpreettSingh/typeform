import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { options, question } from "./__fixtures__/questions";
import {
  type LogicContext,
  changedLogic,
  conditionText,
  countRuleSets,
  deepEqual,
  defaultCondition,
  defaultSource,
  describeCalc,
  describeOtherwise,
  describeRule,
  describeTarget,
  errorsForQuestion,
  isDefaultTarget,
  logicProblems,
  newBranchRule,
  newCalcRule,
  nextTarget,
  normalizeLogic,
  opLabelFor,
  opsForSource,
  parseSourceKey,
  parseTargetKey,
  sourceKey,
  sourcesFor,
  targetKey,
  targetOptions,
  outcomeKey,
  usesSource,
  validOutcome,
  valueSpec,
  withoutQuestionRefs,
} from "./logicSources";
import type { BranchRule, CalcRule, Condition, Logic, PublicQuestion } from "./types";

const choiceProps = (labels: string[]) => ({
  options: options(...labels),
  allow_multiple: false,
  allow_other: false,
  none_of_the_above: false,
  randomize: false,
});

function setup() {
  const mc = question("multiple_choice", choiceProps(["Red", "Blue"]), { title: "Pick one" });
  const num = question("number", {}, { title: "Age" });
  const yn = question("yes_no", {}, { title: "Happy?" });
  const text = question("short_text", {}, { title: "Name" });
  const stmt = question("statement", { button_text: "Go", hide_marks: false }, { title: "Info" });
  const rate = question("rating", { max: 5, shape: "star" }, { title: "Rate" });
  const questions: PublicQuestion[] = [mc, num, yn, text, stmt, rate];
  const ctx: LogicContext = {
    questions,
    endings: [
      { id: 101, title: "Winner" },
      { id: 102, title: "" },
    ],
    variables: [
      { name: "score", type: "number", initial: 0 },
      { name: "mood", type: "text", initial: "ok" },
    ],
    urlParameters: ["utm_source"],
  };
  return { mc, num, yn, text, stmt, rate, questions, ctx };
}

const cond = (source: Condition["source"], op: Condition["op"], value: Condition["value"]): Condition => ({ source, op, value });
const all = (...conditions: Condition[]) => ({ match: "all" as const, conditions });

describe("sources", () => {
  it("offers the current and earlier answerable questions, then variables and URL parameters", () => {
    const { ctx, mc, num, yn, text, stmt } = setup();
    // At the statement: earlier questions only (a statement itself has no answer).
    const at = sourcesFor(ctx, stmt);
    assert.deepEqual(
      at.questions.map((q) => q.id),
      [mc.id, num.id, yn.id, text.id],
    );
    assert.deepEqual(at.variables.map((v) => v.name), ["score", "mood"]);
    assert.deepEqual(at.params, ["utm_source"]);
    // At the number question: itself and the question before it.
    assert.deepEqual(sourcesFor(ctx, num).questions.map((q) => q.id), [mc.id, num.id]);
  });

  it("round-trips source keys", () => {
    for (const source of [{ question: 7 }, { variable: "score" }, { param: "utm_source" }]) {
      assert.deepEqual(parseSourceKey(sourceKey(source)), source);
    }
    assert.equal(parseSourceKey("nonsense"), null);
    assert.equal(parseSourceKey("q:abc"), null);
  });

  it("picks a default source: the current question, else the latest earlier one, else score", () => {
    const { ctx, num, stmt, questions } = setup();
    assert.deepEqual(defaultSource(ctx, num), { question: num.id });
    assert.deepEqual(defaultSource(ctx, stmt), { question: questions[3].id });
    const only = { ...ctx, questions: [stmt] };
    assert.deepEqual(defaultSource(only, stmt), { variable: "score" });
    assert.equal(defaultSource({ ...only, variables: [], urlParameters: [] }, stmt), null);
  });
});

describe("operators and value editors", () => {
  it("lists operators per source kind", () => {
    const { ctx, mc, num } = setup();
    assert.deepEqual(opsForSource(ctx, { question: mc.id }), ["is", "is_not"]);
    assert.deepEqual(opsForSource(ctx, { question: num.id }), ["eq", "neq", "lt", "lte", "gt", "gte"]);
    assert.deepEqual(opsForSource(ctx, { variable: "score" }), ["eq", "neq", "lt", "lte", "gt", "gte"]);
    assert.deepEqual(opsForSource(ctx, { variable: "mood" }), ["is", "is_not", "contains"]);
    assert.deepEqual(opsForSource(ctx, { param: "utm_source" }), ["is", "is_not", "contains"]);
    assert.deepEqual(opsForSource(ctx, { variable: "nope" }), []);
    assert.deepEqual(opsForSource(ctx, { question: 99999 }), []);
  });

  it("words operators the way the question type does", () => {
    const { ctx, num } = setup();
    const date = question("date", { format: "MMDDYYYY", separator: "/" });
    assert.equal(opLabelFor({ ...ctx, questions: [date] }, { question: date.id }, "lt"), "is before");
    assert.equal(opLabelFor(ctx, { question: num.id }, "gt"), "is greater than");
    assert.equal(opLabelFor(ctx, { variable: "score" }, "eq"), "is equal to");
    assert.equal(opLabelFor(ctx, { param: "utm_source" }, "contains"), "contains");
  });

  it("describes the value editor a source needs", () => {
    const { ctx, mc, yn, rate, num, text } = setup();
    assert.deepEqual(valueSpec(ctx, { question: mc.id }), {
      kind: "choice",
      options: [
        { value: "a", label: "A. Red" },
        { value: "b", label: "B. Blue" },
      ],
    });
    const yesNo = valueSpec(ctx, { question: yn.id });
    assert.equal(yesNo.kind, "boolean");
    assert.deepEqual(valueSpec(ctx, { question: rate.id }), { kind: "steps", options: [1, 2, 3, 4, 5] });
    assert.equal(valueSpec(ctx, { question: num.id }).kind, "number");
    assert.equal(valueSpec(ctx, { question: text.id }).kind, "text");
    assert.equal(valueSpec(ctx, { variable: "score" }).kind, "number");
    assert.equal(valueSpec(ctx, { variable: "mood" }).kind, "text");
    assert.equal(valueSpec(ctx, { param: "utm_source" }).kind, "text");
    const nps = question("nps", { labels: { left: "", center: "", right: "" } });
    const spec = valueSpec({ ...ctx, questions: [nps] }, { question: nps.id });
    assert.deepEqual(spec, { kind: "steps", options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    const unnamed = question("dropdown", { options: [{ id: "x", label: "" }], alphabetical: false, randomize: false });
    const spec2 = valueSpec({ ...ctx, questions: [unnamed] }, { question: unnamed.id });
    assert.deepEqual(spec2.kind === "choice" && spec2.options, [{ value: "x", label: "A. Choice 1" }]);
  });

  it("builds a sensible default condition for every kind", () => {
    const { ctx, mc, yn, rate, num, text } = setup();
    assert.deepEqual(defaultCondition(ctx, { question: mc.id }), cond({ question: mc.id }, "is", "a"));
    assert.deepEqual(defaultCondition(ctx, { question: yn.id }), cond({ question: yn.id }, "is", true));
    assert.deepEqual(defaultCondition(ctx, { question: rate.id }), cond({ question: rate.id }, "eq", 5));
    assert.deepEqual(defaultCondition(ctx, { question: num.id }), cond({ question: num.id }, "eq", 0));
    assert.deepEqual(defaultCondition(ctx, { question: text.id }), cond({ question: text.id }, "is", ""));
    assert.deepEqual(defaultCondition(ctx, { variable: "score" }), cond({ variable: "score" }, "eq", 0));
    assert.deepEqual(defaultCondition(ctx, { variable: "mood" }), cond({ variable: "mood" }, "is", ""));
    assert.deepEqual(defaultCondition(ctx, { param: "utm_source" }), cond({ param: "utm_source" }, "is", ""));
  });
});

describe("targets", () => {
  it("lists later questions, then endings, then Default end", () => {
    const { ctx, num, questions } = setup();
    const opts = targetOptions(ctx, num);
    assert.deepEqual(
      opts.map((o) => o.value),
      [...questions.slice(2).map((q) => `q:${q.id}`), "e:101", "e:102", "end"],
    );
    assert.equal(opts[0].label, "3. Happy?");
    assert.equal(opts.find((o) => o.value === "e:101")?.label, "Winner");
    assert.equal(opts.find((o) => o.value === "e:102")?.label, "Ending B");
    assert.equal(opts.at(-1)?.label, "Default end");
  });

  it("round-trips target keys", () => {
    for (const to of [{ question: 4 }, { ending: 9 }, { end: true as const }]) {
      assert.deepEqual(parseTargetKey(targetKey(to)), to);
    }
    assert.equal(parseTargetKey("zzz"), null);
  });

  it("knows the default target: the next question, or the first ending after the last", () => {
    const { ctx, num, rate, questions } = setup();
    assert.deepEqual(nextTarget(ctx, num), { question: questions[2].id });
    assert.deepEqual(nextTarget(ctx, rate), { ending: 101 });
    assert.deepEqual(nextTarget({ ...ctx, endings: [] }, rate), { end: true });
    assert.equal(isDefaultTarget(ctx, num, { question: questions[2].id }), true);
    assert.equal(isDefaultTarget(ctx, num, { question: questions[3].id }), false);
    assert.equal(isDefaultTarget(ctx, rate, { ending: 101 }), true);
    assert.equal(isDefaultTarget(ctx, rate, { ending: 102 }), false);
    assert.equal(isDefaultTarget(ctx, rate, { end: true }), false);
  });

  it("describes targets in words", () => {
    const { ctx, num } = setup();
    assert.equal(describeTarget(ctx, { question: num.id }), "2. Age");
    assert.equal(describeTarget(ctx, { question: 424242 }), "a deleted question");
    assert.equal(describeTarget(ctx, { ending: 101 }), "ending A (Winner)");
    assert.equal(describeTarget(ctx, { ending: 102 }), "ending B");
    assert.equal(describeTarget(ctx, { ending: 7 }), "a deleted ending");
    assert.equal(describeTarget(ctx, { end: true }), "Default end");
  });
});

describe("new rules", () => {
  it("starts a branching rule on the current question, going to the next one", () => {
    const { ctx, mc, num } = setup();
    const rule = newBranchRule(ctx, mc);
    assert.deepEqual(rule, { to: { question: num.id }, when: all(cond({ question: mc.id }, "is", "a")) });
  });

  it("starts a calculation that adds 1 to score", () => {
    const { ctx, mc } = setup();
    const calc = newCalcRule(ctx, mc);
    assert.deepEqual(calc, {
      op: "add",
      value: { number: 1 },
      variable: "score",
      when: all(cond({ question: mc.id }, "is", "a")),
    });
  });
});

describe("sentences", () => {
  it("describes conditions with the question number and title", () => {
    const { ctx, mc, num, yn, text } = setup();
    assert.equal(conditionText(ctx, cond({ question: mc.id }, "is", "b")), "1. Pick one is B. Blue");
    assert.equal(conditionText(ctx, cond({ question: mc.id }, "is_not", "zzz")), "1. Pick one is not a removed choice");
    assert.equal(conditionText(ctx, cond({ question: num.id }, "gt", 18)), "2. Age is greater than 18");
    assert.equal(conditionText(ctx, cond({ question: yn.id }, "is", false)), "3. Happy? is No");
    assert.equal(conditionText(ctx, cond({ question: text.id }, "contains", "bob")), "4. Name contains “bob”");
    assert.equal(conditionText(ctx, cond({ variable: "score" }, "gte", 10)), "score is at least 10");
    assert.equal(conditionText(ctx, cond({ param: "utm_source" }, "is", "ad")), "utm_source is “ad”");
    assert.equal(conditionText(ctx, cond({ question: 999 }, "is", "a")), "a deleted question is a");
  });

  it("joins conditions with and / or", () => {
    const { ctx, mc, num } = setup();
    const when = { match: "any" as const, conditions: [cond({ question: mc.id }, "is", "a"), cond({ question: num.id }, "lt", 3)] };
    const rule: BranchRule = { to: { ending: 101 }, when };
    assert.equal(describeRule(ctx, rule), "If 1. Pick one is A. Red or 2. Age is less than 3, go to ending A (Winner)");
    assert.equal(describeRule(ctx, { ...rule, when: { ...when, match: "all" } }), "If 1. Pick one is A. Red and 2. Age is less than 3, go to ending A (Winner)");
  });

  it("says Always go to without rules, and All other cases go to with rules", () => {
    const { ctx, num } = setup();
    assert.equal(describeOtherwise(ctx, num, { rules: [], otherwise: null }), "Always go to 3. Happy?");
    assert.equal(describeOtherwise(ctx, num, { rules: [], otherwise: { end: true } }), "Always go to Default end");
    const rule: BranchRule = { to: { end: true }, when: all(cond({ question: num.id }, "eq", 1)) };
    assert.equal(describeOtherwise(ctx, num, { rules: [rule], otherwise: null }), "All other cases go to 3. Happy?");
    assert.equal(describeOtherwise(ctx, num, { rules: [rule], otherwise: { ending: 102 } }), "All other cases go to ending B");
  });

  it("describes calculations", () => {
    const { ctx, mc } = setup();
    const when = all(cond({ question: mc.id }, "is", "a"));
    const calc = (op: CalcRule["op"], value: CalcRule["value"]): CalcRule => ({ op, value, variable: "score", when });
    assert.equal(describeCalc(ctx, calc("add", { number: 5 })), "Add 5 to score when 1. Pick one is A. Red");
    assert.equal(describeCalc(ctx, calc("subtract", { number: 2 })), "Subtract 2 from score when 1. Pick one is A. Red");
    assert.equal(describeCalc(ctx, calc("multiply", { number: 3 })), "Multiply score by 3 when 1. Pick one is A. Red");
    assert.equal(describeCalc(ctx, calc("divide", { variable: "score" })), "Divide score by score when 1. Pick one is A. Red");
  });
});

describe("completeness", () => {
  const rulesOf = (branch: Logic["branch"], calc: CalcRule[] = []): Logic => ({ version: 2, branch, calc });

  it("accepts a good logic and reports where each problem is", () => {
    const { ctx, mc, num } = setup();
    const good = rulesOf({ rules: [newBranchRule(ctx, mc)], otherwise: null }, [newCalcRule(ctx, mc)]);
    assert.deepEqual(logicProblems(ctx, mc, good), []);

    const bad = rulesOf({
      rules: [
        { to: { question: mc.id }, when: all(cond({ question: mc.id }, "is", "a")) }, // not forward
        { to: { question: num.id }, when: all(cond({ question: mc.id }, "is", "")) }, // blank choice
        { to: { ending: 555 }, when: all(cond({ question: mc.id }, "is", "a")) }, // missing ending
        { to: { question: num.id }, when: all(cond({ question: num.id }, "eq", 1)) }, // source not available at mc
      ],
      otherwise: { question: 424242 },
    });
    const paths = logicProblems(ctx, mc, bad).map((p) => p.path);
    assert.deepEqual(paths, [
      "branch.rules.0.to",
      "branch.rules.1.when.conditions.0.value",
      "branch.rules.2.to",
      "branch.rules.3.when.conditions.0.source",
      "branch.otherwise",
    ]);
  });

  it("checks numbers, text and calculation values", () => {
    const { ctx, num, text } = setup();
    const logic = rulesOf(
      {
        rules: [
          { to: { question: ctx.questions[3].id }, when: all(cond({ question: num.id }, "eq", "" as unknown as number)) },
          { to: { question: ctx.questions[3].id }, when: all(cond({ param: "utm_source" }, "is", "")) },
        ],
        otherwise: null,
      },
      [
        { op: "add", value: { number: Number.NaN }, variable: "score", when: all(cond({ question: num.id }, "eq", 1)) },
        { op: "add", value: { variable: "mood" }, variable: "score", when: all(cond({ question: num.id }, "eq", 1)) },
        { op: "add", value: { number: 1 }, variable: "mood", when: all(cond({ question: num.id }, "eq", 1)) },
        { op: "add", value: { number: 1 }, variable: "score", when: { match: "all", conditions: [] } },
      ],
    );
    void text;
    assert.deepEqual(
      logicProblems(ctx, num, logic).map((p) => p.path),
      [
        "branch.rules.0.when.conditions.0.value",
        "branch.rules.1.when.conditions.0.value",
        "calc.0.value",
        "calc.1.value",
        "calc.2.variable",
        "calc.3.when",
      ],
    );
  });
});

describe("rule sets and normalising", () => {
  it("counts rule sets for the badge", () => {
    const { ctx, mc } = setup();
    assert.equal(countRuleSets(null), 0);
    assert.equal(countRuleSets({ version: 2, branch: { rules: [], otherwise: null }, calc: [] }), 0);
    assert.equal(countRuleSets({ version: 2, branch: { rules: [], otherwise: { end: true } }, calc: [] }), 1);
    const logic: Logic = {
      version: 2,
      branch: { rules: [newBranchRule(ctx, mc), newBranchRule(ctx, mc)], otherwise: { end: true } },
      calc: [newCalcRule(ctx, mc)],
    };
    assert.equal(countRuleSets(logic), 3);
  });

  it("turns an empty logic into null", () => {
    assert.equal(normalizeLogic(null), null);
    assert.equal(normalizeLogic({ version: 2, branch: { rules: [], otherwise: null }, calc: [] }), null);
    const keep: Logic = { version: 2, branch: { rules: [], otherwise: { end: true } }, calc: [] };
    assert.equal(normalizeLogic(keep), keep);
  });

  it("compares logic structurally and lists what changed", () => {
    const { mc, num } = setup();
    const a: Logic = { version: 2, branch: { rules: [], otherwise: { end: true } }, calc: [] };
    const sameButReordered = { calc: [], branch: { otherwise: { end: true }, rules: [] }, version: 2 } as Logic;
    assert.equal(deepEqual(a, sameButReordered), true);
    assert.equal(deepEqual(a, { ...a, calc: [{} as CalcRule] }), false);
    mc.logic = a;
    const draft = new Map<number, Logic | null>([
      [mc.id, sameButReordered],
      [num.id, { version: 2, branch: { rules: [], otherwise: { question: 1 } }, calc: [] }],
    ]);
    assert.deepEqual(Object.keys(changedLogic([mc, num], draft)), [String(num.id)]);
    // An emptied logic is sent as null.
    draft.set(mc.id, { version: 2, branch: { rules: [], otherwise: null }, calc: [] });
    assert.equal(changedLogic([mc, num], draft)[String(mc.id)], null);
  });
});

describe("references", () => {
  it("drops rules that jump to a removed question and conditions that read it", () => {
    const { ctx, mc, num, yn } = setup();
    const logic: Logic = {
      version: 2,
      branch: {
        rules: [
          { to: { question: num.id }, when: all(cond({ question: mc.id }, "is", "a")) },
          { to: { question: yn.id }, when: all(cond({ question: mc.id }, "is", "a"), cond({ question: num.id }, "eq", 1)) },
          { to: { question: yn.id }, when: all(cond({ question: num.id }, "eq", 1)) },
        ],
        otherwise: { question: num.id },
      },
      calc: [{ ...newCalcRule(ctx, mc), when: all(cond({ question: num.id }, "eq", 1)) }, newCalcRule(ctx, mc)],
    };
    const next = withoutQuestionRefs(logic, num.id)!;
    assert.equal(next.branch.rules.length, 1);
    assert.deepEqual(next.branch.rules[0].to, { question: yn.id });
    assert.equal(next.branch.rules[0].when.conditions.length, 1);
    assert.equal(next.branch.otherwise, null);
    assert.equal(next.calc.length, 1);
    assert.equal(withoutQuestionRefs(logic, 31337), logic);
    assert.equal(withoutQuestionRefs({ version: 2, branch: { rules: [], otherwise: { question: 5 } }, calc: [] }, 5), null);
  });
});

describe("server errors", () => {
  it("keeps the errors of one question, with the questions.<id>. prefix removed", () => {
    const errors = {
      "questions.12.branch.rules.0.to": "Jumps only go forward",
      "questions.12.calc.1.value": "Enter a number",
      "questions.13.branch.otherwise": "No such ending",
      variables: "Too many",
    };
    assert.deepEqual(errorsForQuestion(errors, 12), {
      "branch.rules.0.to": "Jumps only go forward",
      "calc.1.value": "Enter a number",
    });
    assert.deepEqual(errorsForQuestion(errors, 14), {});
  });
});

describe("usage", () => {
  it("finds rules that read or write a variable or URL parameter", () => {
    const { ctx, mc } = setup();
    const logic: Logic = {
      version: 2,
      branch: { rules: [{ to: { end: true }, when: all(cond({ variable: "mood" }, "is", "x")) }], otherwise: null },
      calc: [
        { ...newCalcRule(ctx, mc), when: all(cond({ param: "utm_source" }, "is", "ad")) },
        { op: "add", value: { variable: "bonus" }, variable: "score", when: all(cond({ question: mc.id }, "is", "a")) },
      ],
    };
    mc.logic = logic;
    assert.equal(usesSource([mc], { variable: "mood" }), 1);
    assert.equal(usesSource([mc], { param: "utm_source" }), 1);
    assert.equal(usesSource([mc], { variable: "score" }), 2); // written by two calculations
    assert.equal(usesSource([mc], { variable: "bonus" }), 1); // used as a value
    assert.equal(usesSource([mc], { variable: "nope" }), 0);
  });
});

describe("outcome entries", () => {
  it("keeps only entries whose question and choice still exist", () => {
    const { mc, num } = setup();
    const kept = { question: mc.id, choice: "a" };
    const entries = [kept, { question: mc.id, choice: "gone" }, { question: num.id, choice: "a" }, { question: 9999, choice: "a" }];
    assert.deepEqual(validOutcome(entries, [mc, num]), [kept]);
    assert.equal(outcomeKey(kept), `${mc.id}:a`);
  });
});

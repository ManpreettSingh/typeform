import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { options, question } from "./__fixtures__/questions";
import { NUMBER_VARIABLE_OPS, OPS_BY_TYPE, TEXT_SOURCE_OPS, canEndAfter, opLabel, resolve, ruleMatches } from "./logic";
import type { BranchRule, CalcRule, Condition, FormVariable, Logic, LogicTarget, PublicQuestion } from "./types";

const choices = options("A", "B");

describe("ruleMatches", () => {
  it("matches choices, including multi-select picks", () => {
    assert.equal(ruleMatches("multiple_choice", { op: "is", value: "a" }, ["a", "b"]), true);
    assert.equal(ruleMatches("multiple_choice", { op: "is_not", value: "a" }, ["b"]), true);
    assert.equal(ruleMatches("dropdown", { op: "is", value: "a" }, "b"), false);
  });

  it("matches yes/no exactly", () => {
    assert.equal(ruleMatches("yes_no", { op: "is", value: true }, true), true);
    assert.equal(ruleMatches("yes_no", { op: "is", value: true }, false), false);
  });

  it("compares numbers, parsing typed text", () => {
    assert.equal(ruleMatches("number", { op: "gt", value: 5 }, "7"), true);
    assert.equal(ruleMatches("rating", { op: "lte", value: 3 }, 4), false);
    assert.equal(ruleMatches("number", { op: "eq", value: 5 }, "x"), false);
  });

  it("compares text ignoring case and spaces", () => {
    assert.equal(ruleMatches("short_text", { op: "contains", value: "bc" }, " ABCD "), true);
    assert.equal(ruleMatches("email", { op: "is", value: "A@B.C" }, "a@b.c"), true);
    assert.equal(ruleMatches("long_text", { op: "is_not", value: "x" }, "y"), true);
  });

  it("never matches an unanswered question", () => {
    assert.equal(ruleMatches("short_text", { op: "is_not", value: "x" }, undefined), false);
    assert.equal(ruleMatches("short_text", { op: "is_not", value: "x" }, "  "), false);
  });
});

// ---- v2 helpers ----------------------------------------------------------------

const SCORE: FormVariable = { name: "score", type: "number", initial: 0 };
const is = (q: PublicQuestion, value: Condition["value"], op: Condition["op"] = "is"): Condition => ({
  source: { question: q.id },
  op,
  value,
});
const goTo = (to: LogicTarget, ...conditions: Condition[]): BranchRule => ({ to, when: { match: "all", conditions } });
const branching = (rules: BranchRule[], otherwise: LogicTarget | null = null, calc: CalcRule[] = []): Logic => ({
  version: 2,
  branch: { rules, otherwise },
  calc,
});
const form = (questions: PublicQuestion[], extra: { endings?: number[]; variables?: FormVariable[] } = {}) => ({
  questions,
  endings: (extra.endings ?? []).map((id, position) => ({ id, position, outcome: [] })),
  variables: extra.variables ?? [SCORE],
});

describe("resolve: the path", () => {
  it("jumps forward, to an ending, and ignores backward or missing targets", () => {
    const [a, b, c, d] = [question("yes_no"), question("short_text"), question("short_text"), question("short_text")];
    const all = form([a, b, c, d], { endings: [50] });
    a.logic = branching([goTo({ question: c.id }, is(a, true))]);
    assert.deepEqual(resolve(all, { [a.id]: true }).path, [a.id, c.id, d.id]);
    assert.deepEqual(resolve(all, { [a.id]: false }).path, [a.id, b.id, c.id, d.id]);
    a.logic = branching([goTo({ ending: 50 }, is(a, true))]);
    assert.deepEqual(resolve(all, { [a.id]: true }).path, [a.id]);
    c.logic = branching([goTo({ question: a.id }, is(c, "zzz", "is_not"))]); // backward: ignored
    assert.deepEqual(resolve(all, { [c.id]: "hello" }).path, [a.id, b.id, c.id, d.id]);
    c.logic = branching([goTo({ question: 9999 }, is(c, "zzz", "is_not"))]); // missing: ignored
    assert.deepEqual(resolve(all, { [c.id]: "hello" }).path, [a.id, b.id, c.id, d.id]);
  });

  it("lists the questions a respondent goes through", () => {
    const [a, b, c] = [question("yes_no"), question("short_text"), question("short_text")];
    a.logic = branching([goTo({ question: c.id }, is(a, true))]);
    assert.deepEqual(resolve(form([a, b, c]), { [a.id]: true }).path, [a.id, c.id]);
    assert.deepEqual(resolve(form([a, b, c]), { [a.id]: false }).path, [a.id, b.id, c.id]);
  });

  it("answers the next screen and knows which question finishes the form", () => {
    const [a, b, c] = [question("yes_no"), question("short_text"), question("short_text")];
    a.logic = branching([goTo({ question: c.id }, is(a, true))]);
    const skipping = resolve(form([a, b, c]), { [a.id]: true });
    assert.equal(skipping.nextAfter(a.id), c.id);
    assert.equal(skipping.nextAfter(c.id), null);
    assert.equal(skipping.nextAfter(b.id), null, "off the path");
    assert.equal(resolve(form([a, b, c]), { [a.id]: false }).nextAfter(a.id), b.id);
  });

  it("ignores answers of questions that are not on the path", () => {
    const [a, b, c] = [question("yes_no"), question("yes_no"), question("short_text")];
    a.logic = branching([goTo({ question: c.id }, is(a, true))]);
    b.logic = branching([goTo({ ending: 51 }, is(b, true))]);
    const result = resolve(form([a, b, c], { endings: [50, 51] }), { [a.id]: true, [b.id]: true });
    assert.deepEqual(result.path, [a.id, c.id]);
    assert.deepEqual(result.ending, { id: 50 }); // the first ending, not b's jump
  });

  it("reads a condition on an earlier question, never a later one", () => {
    const [a, b, c] = [question("yes_no"), question("yes_no"), question("short_text")];
    a.logic = branching([goTo({ question: c.id }, is(b, true))]); // b is after a
    assert.deepEqual(resolve(form([a, b, c]), { [a.id]: true, [b.id]: true }).path, [a.id, b.id, c.id]);
    b.logic = branching([goTo({ ending: 50 }, is(a, true), is(b, true))]);
    assert.deepEqual(resolve(form([a, b, c], { endings: [50] }), { [a.id]: true, [b.id]: true }).path, [a.id, b.id]);
  });

  it("runs 'all other cases' only when no rule matches", () => {
    const [a, b, c] = [question("yes_no"), question("short_text"), question("short_text")];
    a.logic = branching([goTo({ question: b.id }, is(a, true))], { question: c.id });
    assert.deepEqual(resolve(form([a, b, c]), { [a.id]: true }).path, [a.id, b.id, c.id]);
    assert.deepEqual(resolve(form([a, b, c]), { [a.id]: false }).path, [a.id, c.id]);
  });

  it("joins conditions with any / all", () => {
    const [a, b, c] = [question("yes_no"), question("yes_no"), question("short_text")];
    const any: BranchRule = { to: { ending: 50 }, when: { match: "any", conditions: [is(a, true), is(b, true)] } };
    const all: BranchRule = { to: { ending: 50 }, when: { match: "all", conditions: [is(a, true), is(b, true)] } };
    b.logic = branching([any]);
    assert.deepEqual(resolve(form([a, b, c], { endings: [50] }), { [a.id]: false, [b.id]: true }).path, [a.id, b.id]);
    b.logic = branching([all]);
    assert.deepEqual(
      resolve(form([a, b, c], { endings: [50] }), { [a.id]: false, [b.id]: true }).path,
      [a.id, b.id, c.id],
    );
  });

  it("never treats a rule with no conditions as unconditional", () => {
    const [a, b] = [question("yes_no"), question("short_text")];
    a.logic = branching([goTo({ ending: 50 })]);
    assert.deepEqual(resolve(form([a, b], { endings: [50] }), { [a.id]: true }).path, [a.id, b.id]);
  });

  it("sends detractors somewhere else", () => {
    const [score, followUp, thanks] = [question("nps"), question("long_text"), question("short_text")];
    score.logic = branching([
      goTo({ question: followUp.id }, is(score, 6, "lte")),
      goTo({ question: thanks.id }, is(score, 9, "gte")),
    ]);
    const all = form([score, followUp, thanks]);
    assert.deepEqual(resolve(all, { [score.id]: 3 }).path, [score.id, followUp.id, thanks.id]);
    assert.deepEqual(resolve(all, { [score.id]: 10 }).path, [score.id, thanks.id]);
    assert.deepEqual(resolve(all, { [score.id]: 8 }).path, [score.id, followUp.id, thanks.id]);
  });
});

describe("resolve: groups", () => {
  it("shows a header with children, skips an empty one, and lands a jump on the first child", () => {
    const [a, header, c, d, empty] = [
      question("yes_no"),
      question("group"),
      question("short_text"),
      question("short_text"),
      question("group"),
    ];
    Object.assign(c, { group_id: header.id });
    Object.assign(d, { group_id: header.id });
    const all = form([a, header, c, d, empty]);
    assert.deepEqual(resolve(all, {}).path, [a.id, header.id, c.id, d.id]);
    a.logic = branching([goTo({ question: header.id }, is(a, true))]);
    assert.deepEqual(resolve(all, { [a.id]: true }).path, [a.id, c.id, d.id]);
  });
});

describe("resolve: variables", () => {
  const calc = (op: CalcRule["op"], number: number, variable: string, ...conditions: Condition[]): CalcRule => ({
    op,
    value: { number },
    variable,
    when: { match: "all", conditions },
  });

  it("starts from the initial values and applies every matching calculation in order", () => {
    const [a, b] = [question("yes_no"), question("short_text")];
    a.logic = branching([], null, [
      calc("add", 10, "score", is(a, true)),
      calc("multiply", 2, "score", is(a, true)),
      calc("subtract", 1, "score", is(a, false)),
    ]);
    const start: FormVariable = { ...SCORE, initial: 1 };
    assert.deepEqual(resolve(form([a, b], { variables: [start] }), { [a.id]: true }).variables, { score: 22 });
    assert.deepEqual(resolve(form([a, b], { variables: [start] }), { [a.id]: false }).variables, { score: 0 });
  });

  it("leaves a variable alone on divide by zero, and text variables never change", () => {
    const a = question("yes_no");
    a.logic = branching([], null, [calc("divide", 0, "score", is(a, true)), calc("add", 1, "tag", is(a, true))]);
    const variables: FormVariable[] = [{ ...SCORE, initial: 7 }, { name: "tag", type: "text", initial: "vip" }];
    assert.deepEqual(resolve(form([a], { variables }), { [a.id]: true }).variables, { score: 7, tag: "vip" });
  });

  it("reports the values as they were when a question is shown", () => {
    const [a, b] = [question("yes_no"), question("short_text")];
    a.logic = branching([], null, [calc("add", 5, "score", is(a, true))]);
    const result = resolve(form([a, b]), { [a.id]: true });
    assert.equal(result.variablesAt(a.id).score, 0);
    assert.equal(result.variablesAt(b.id).score, 5);
    assert.equal(result.variables.score, 5);
  });

  it("compares a text URL parameter ignoring case; an absent one never matches, even 'is not'", () => {
    const [a, b, c] = [question("yes_no"), question("short_text"), question("short_text")];
    const param = (op: Condition["op"], value: string): Condition => ({ source: { param: "utm_source" }, op, value });
    a.logic = branching([goTo({ question: c.id }, param("is_not", "google"))]);
    const all = form([a, b, c]);
    assert.deepEqual(resolve(all, {}, { utm_source: "Bing" }).path, [a.id, c.id]);
    assert.deepEqual(resolve(all, {}, { utm_source: "GOOGLE" }).path, [a.id, b.id, c.id]);
    assert.deepEqual(resolve(all, {}, {}).path, [a.id, b.id, c.id]);
  });
});

describe("resolve: endings", () => {
  const endings = (...outcomes: { question: number; choice: string }[][]) =>
    outcomes.map((outcome, i) => ({ id: 100 + i, position: i, outcome }));

  it("shows the first ending without rules, and the Default end without endings", () => {
    const a = question("short_text");
    assert.deepEqual(resolve({ questions: [a], endings: endings([], []) }, {}).ending, { id: 100 });
    assert.deepEqual(resolve({ questions: [a], endings: [] }, {}).ending, { default: true });
    assert.deepEqual(resolve({ questions: [a] }, {}).ending, { default: true });
  });

  it("goes to the ending a rule names, or the Default end", () => {
    const [a, b] = [question("yes_no"), question("short_text")];
    a.logic = branching([goTo({ ending: 101 }, is(a, true)), goTo({ end: true }, is(a, false))]);
    const all = { questions: [a, b], endings: endings([], []) };
    assert.deepEqual(resolve(all, { [a.id]: true }).ending, { id: 101 });
    assert.deepEqual(resolve(all, { [a.id]: false }).ending, { default: true });
    assert.deepEqual(resolve(all, { [a.id]: false }).path, [a.id]);
  });

  it("picks the outcome quiz winner, ties to the earliest ending, none scored to the first", () => {
    const [a, b] = [
      question("multiple_choice", { options: options("A", "B") }),
      question("multiple_choice", { options: options("X", "Y") }),
    ];
    const quiz = {
      questions: [a, b],
      endings: endings(
        [{ question: a.id, choice: "a" }],
        [
          { question: a.id, choice: "b" },
          { question: b.id, choice: "b" },
        ],
        [{ question: b.id, choice: "b" }],
      ),
    };
    assert.deepEqual(resolve(quiz, { [a.id]: "b", [b.id]: "b" }).ending, { id: 101 }, "two points");
    assert.deepEqual(resolve(quiz, { [a.id]: "a", [b.id]: "b" }).ending, { id: 100 }, "tie: the earliest");
    assert.deepEqual(resolve(quiz, { [a.id]: "b", [b.id]: "a" }).ending, { id: 101 });
    assert.deepEqual(resolve(quiz, {}).ending, { id: 100 }, "nobody scored");
    assert.deepEqual(resolve(quiz, { [b.id]: "b" }).ending, { id: 101 }, "101 and 102 tie on one point");
  });
});

describe("canEndAfter", () => {
  it("is true for the last question and for a question with a rule that jumps to an ending", () => {
    const [a, b] = [question("yes_no"), question("short_text")];
    assert.equal(canEndAfter([a, b], 1), true);
    assert.equal(canEndAfter([a, b], 0), false);
    a.logic = branching([goTo({ ending: 50 }, is(a, true))]);
    assert.equal(canEndAfter([a, b], 0), true);
    a.logic = branching([goTo({ question: b.id }, is(a, true))], { end: true });
    assert.equal(canEndAfter([a, b], 0), true);
    a.logic = branching([goTo({ question: b.id }, is(a, true))]);
    assert.equal(canEndAfter([a, b], 0), false);
  });
});

describe("variable and URL parameter conditions", () => {
  it("offer numeric operators for number variables and text operators for text and parameters", () => {
    assert.deepEqual(NUMBER_VARIABLE_OPS, ["eq", "neq", "lt", "lte", "gt", "gte"]);
    assert.deepEqual(TEXT_SOURCE_OPS, ["is", "is_not", "contains"]);
  });
});

describe("OPS_BY_TYPE", () => {
  it("offers the same conditions as the server", () => {
    assert.deepEqual(OPS_BY_TYPE.multiple_choice, ["is", "is_not"]);
    assert.deepEqual(OPS_BY_TYPE.yes_no, ["is"]);
    assert.deepEqual(OPS_BY_TYPE.rating, ["eq", "neq", "lt", "lte", "gt", "gte"]);
    assert.deepEqual(OPS_BY_TYPE.email, ["is", "is_not", "contains"]);
    assert.deepEqual(OPS_BY_TYPE.dropdown, ["is", "is_not"]);
    void choices;
  });
});

describe("website and phone number branching", () => {
  it("branch like text", () => {
    assert.deepEqual(OPS_BY_TYPE.website, ["is", "is_not", "contains"]);
    assert.deepEqual(OPS_BY_TYPE.phone_number, ["is", "is_not", "contains"]);
    assert.equal(ruleMatches("website", { op: "contains", value: "example" }, "https://www.example.com"), true);
    assert.equal(ruleMatches("phone_number", { op: "is", value: "+12015550123" }, "+12015550123"), true);
  });
});

describe("legal, checkbox, opinion scale and NPS branching", () => {
  it("offers the same conditions as the server", () => {
    assert.deepEqual(OPS_BY_TYPE.legal, ["is"]);
    assert.deepEqual(OPS_BY_TYPE.checkbox, ["is"]);
    assert.deepEqual(OPS_BY_TYPE.opinion_scale, ["eq", "neq", "lt", "lte", "gt", "gte"]);
    assert.deepEqual(OPS_BY_TYPE.nps, ["eq", "neq", "lt", "lte", "gt", "gte"]);
  });

  it("matches consent answers exactly", () => {
    assert.equal(ruleMatches("legal", { op: "is", value: false }, false), true);
    assert.equal(ruleMatches("legal", { op: "is", value: true }, false), false);
    assert.equal(ruleMatches("checkbox", { op: "is", value: true }, true), true);
    assert.equal(ruleMatches("checkbox", { op: "is", value: true }, undefined), false);
  });

  it("compares scale answers as numbers, zero included", () => {
    assert.equal(ruleMatches("nps", { op: "lte", value: 6 }, 0), true);
    assert.equal(ruleMatches("nps", { op: "lte", value: 6 }, 7), false);
    assert.equal(ruleMatches("opinion_scale", { op: "gte", value: 8 }, 8), true);
  });
});

describe("date branching", () => {
  it("offers before / after / equality and compares real dates", () => {
    assert.deepEqual(OPS_BY_TYPE.date, ["is", "is_not", "lt", "lte", "gt", "gte"]);
    assert.equal(ruleMatches("date", { op: "lt", value: "2026-06-01" }, "2026-05-31"), true);
    assert.equal(ruleMatches("date", { op: "gte", value: "2026-06-01" }, "2026-06-01"), true);
    assert.equal(ruleMatches("date", { op: "is", value: "2026-06-01" }, "2026-06-02"), false);
    assert.equal(ruleMatches("date", { op: "gt", value: "not a date" }, "2026-06-02"), false);
  });

  it("words the conditions as dates", () => {
    assert.equal(opLabel("date", "lt"), "is before");
    assert.equal(opLabel("date", "gte"), "is on or after");
    assert.equal(opLabel("number", "lt"), "is less than");
  });
});

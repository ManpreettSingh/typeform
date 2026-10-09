import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { options, question } from "./__fixtures__/questions";
import { OPS_BY_TYPE, canEndAfter, nextIndex, opLabel, ruleMatches, visitedPath } from "./logic";

const choices = options("A", "B");

describe("ruleMatches", () => {
  it("matches choices, including multi-select picks", () => {
    assert.equal(ruleMatches("multiple_choice", { op: "is", value: "a", to: "end" }, ["a", "b"]), true);
    assert.equal(ruleMatches("multiple_choice", { op: "is_not", value: "a", to: "end" }, ["b"]), true);
    assert.equal(ruleMatches("dropdown", { op: "is", value: "a", to: "end" }, "b"), false);
  });

  it("matches yes/no exactly", () => {
    assert.equal(ruleMatches("yes_no", { op: "is", value: true, to: "end" }, true), true);
    assert.equal(ruleMatches("yes_no", { op: "is", value: true, to: "end" }, false), false);
  });

  it("compares numbers, parsing typed text", () => {
    assert.equal(ruleMatches("number", { op: "gt", value: 5, to: "end" }, "7"), true);
    assert.equal(ruleMatches("rating", { op: "lte", value: 3, to: "end" }, 4), false);
    assert.equal(ruleMatches("number", { op: "eq", value: 5, to: "end" }, "x"), false);
  });

  it("compares text ignoring case and spaces", () => {
    assert.equal(ruleMatches("short_text", { op: "contains", value: "bc", to: "end" }, " ABCD "), true);
    assert.equal(ruleMatches("email", { op: "is", value: "A@B.C", to: "end" }, "a@b.c"), true);
    assert.equal(ruleMatches("long_text", { op: "is_not", value: "x", to: "end" }, "y"), true);
  });

  it("never matches an unanswered question", () => {
    assert.equal(ruleMatches("short_text", { op: "is_not", value: "x", to: "end" }, undefined), false);
    assert.equal(ruleMatches("short_text", { op: "is_not", value: "x", to: "end" }, "  "), false);
  });
});

describe("branching", () => {
  it("jumps forward, to the end, and ignores backward or missing targets", () => {
    const [a, b, c, d] = [question("yes_no"), question("short_text"), question("short_text"), question("short_text")];
    const all = [a, b, c, d];
    a.logic = { rules: [{ op: "is", value: true, to: c.id }] };
    assert.equal(nextIndex(all, 0, { [a.id]: true }), 2);
    assert.equal(nextIndex(all, 0, { [a.id]: false }), 1);
    a.logic = { rules: [{ op: "is", value: true, to: "end" }] };
    assert.equal(nextIndex(all, 0, { [a.id]: true }), null);
    c.logic = { rules: [{ op: "is_not", value: "zzz", to: a.id }] }; // backward: skipped
    assert.equal(nextIndex(all, 2, { [c.id]: "hello" }), 3);
    assert.equal(nextIndex(all, 3, {}), null);
  });

  it("lists the questions a respondent goes through", () => {
    const [a, b, c] = [question("yes_no"), question("short_text"), question("short_text")];
    a.logic = { rules: [{ op: "is", value: true, to: c.id }] };
    assert.deepEqual(visitedPath([a, b, c], { [a.id]: true }), [0, 2]);
    assert.deepEqual(visitedPath([a, b, c], { [a.id]: false }), [0, 1, 2]);
  });

  it("knows when answering can finish the form", () => {
    const [a, b] = [question("yes_no"), question("short_text")];
    assert.equal(canEndAfter([a, b], 1), true);
    assert.equal(canEndAfter([a, b], 0), false);
    a.logic = { rules: [{ op: "is", value: true, to: "end" }] };
    assert.equal(canEndAfter([a, b], 0), true);
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
    assert.equal(ruleMatches("website", { op: "contains", value: "example", to: "end" }, "https://www.example.com"), true);
    assert.equal(ruleMatches("phone_number", { op: "is", value: "+12015550123", to: "end" }, "+12015550123"), true);
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
    assert.equal(ruleMatches("legal", { op: "is", value: false, to: "end" }, false), true);
    assert.equal(ruleMatches("legal", { op: "is", value: true, to: "end" }, false), false);
    assert.equal(ruleMatches("checkbox", { op: "is", value: true, to: "end" }, true), true);
    assert.equal(ruleMatches("checkbox", { op: "is", value: true, to: "end" }, undefined), false);
  });

  it("compares scale answers as numbers, zero included", () => {
    assert.equal(ruleMatches("nps", { op: "lte", value: 6, to: "end" }, 0), true);
    assert.equal(ruleMatches("nps", { op: "lte", value: 6, to: "end" }, 7), false);
    assert.equal(ruleMatches("opinion_scale", { op: "gte", value: 8, to: "end" }, 8), true);
  });

  it("sends detractors somewhere else", () => {
    const [score, followUp, thanks] = [question("nps"), question("long_text"), question("short_text")];
    score.logic = { rules: [{ op: "lte", value: 6, to: followUp.id }, { op: "gte", value: 9, to: thanks.id }] };
    const all = [score, followUp, thanks];
    assert.deepEqual(visitedPath(all, { [score.id]: 3 }), [0, 1, 2]);
    assert.deepEqual(visitedPath(all, { [score.id]: 10 }), [0, 2]);
    assert.deepEqual(visitedPath(all, { [score.id]: 8 }), [0, 1, 2]);
  });
});

describe("date branching", () => {
  it("offers before / after / equality and compares real dates", () => {
    assert.deepEqual(OPS_BY_TYPE.date, ["is", "is_not", "lt", "lte", "gt", "gte"]);
    assert.equal(ruleMatches("date", { op: "lt", value: "2026-06-01", to: "end" }, "2026-05-31"), true);
    assert.equal(ruleMatches("date", { op: "gte", value: "2026-06-01", to: "end" }, "2026-06-01"), true);
    assert.equal(ruleMatches("date", { op: "is", value: "2026-06-01", to: "end" }, "2026-06-02"), false);
    assert.equal(ruleMatches("date", { op: "gt", value: "not a date", to: "end" }, "2026-06-02"), false);
  });

  it("words the conditions as dates", () => {
    assert.equal(opLabel("date", "lt"), "is before");
    assert.equal(opLabel("date", "gte"), "is on or after");
    assert.equal(opLabel("number", "lt"), "is less than");
  });
});

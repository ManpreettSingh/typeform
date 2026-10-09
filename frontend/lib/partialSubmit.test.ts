import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { question } from "./__fixtures__/questions";
import { toRespondentQuestions } from "./partialSubmit";

const ids = (list: { id: number }[]) => list.map((q) => q.id);

describe("toRespondentQuestions: what a respondent is actually asked", () => {
  it("leaves a form without a point as it is", () => {
    const qs = [question("short_text"), question("email")];
    assert.deepEqual(toRespondentQuestions(qs), qs);
  });

  it("never shows a Partial Submit Point, and marks the question before it", () => {
    const [a, b, point, c] = [question("short_text"), question("email"), question("partial_submit"), question("short_text")];
    const shown = toRespondentQuestions([a, b, point, c]);
    assert.deepEqual(ids(shown), [a.id, b.id, c.id]);
    assert.equal(shown[1].partial_submit_after, true);
    assert.equal(shown[0].partial_submit_after, undefined);
    assert.equal(shown[2].partial_submit_after, undefined);
  });

  it("marks one question for several points in a row", () => {
    const [a, p1, p2, b] = [question("short_text"), question("partial_submit"), question("partial_submit"), question("short_text")];
    const shown = toRespondentQuestions([a, p1, p2, b]);
    assert.deepEqual(ids(shown), [a.id, b.id]);
    assert.equal(shown[0].partial_submit_after, true);
  });

  it("marks the question before a point at the very end", () => {
    const [a, point] = [question("short_text"), question("partial_submit")];
    const shown = toRespondentQuestions([a, point]);
    assert.deepEqual(ids(shown), [a.id]);
    assert.equal(shown[0].partial_submit_after, true);
  });

  it("has nothing to mark for a point at the start", () => {
    const [point, a] = [question("partial_submit"), question("short_text")];
    const shown = toRespondentQuestions([point, a]);
    assert.deepEqual(ids(shown), [a.id]);
    assert.equal(shown[0].partial_submit_after, undefined);
  });

  it("doesn't change the questions it is given", () => {
    const [a, point] = [question("short_text"), question("partial_submit")];
    toRespondentQuestions([a, point]);
    assert.equal(a.partial_submit_after, undefined);
  });
});

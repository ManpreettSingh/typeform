import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proposalToPreview, changeLabel } from "./preview";
import type { Proposal, QuestionChange } from "./types";

const base = (): Proposal => ({
  welcome: { title: "Cafe", description: "Tell us!", button_text: "Go", show_time_to_complete: true, show_submission_count: false },
  questions: [
    { id: 7, type: "short_text", title: "Name?", description: null, required: true, properties: {}, group_id: null },
    { id: null, type: "email", title: "Email?", description: "We won't spam", required: false, properties: {}, group_id: null },
    { id: 10, type: "group", title: "About you", description: null, required: false, properties: { button_text: "Continue" }, group_id: null },
    { id: null, type: "number", title: "Age?", description: null, required: false, properties: {}, group_id: 10 },
  ],
  endings: [
    { id: 3, title: "Thanks!", message: "See you", button_text: "Visit", button_url: "https://example.com" },
    { id: null, title: "Second", message: "m", button_text: null, button_url: null },
  ],
});

describe("proposalToPreview", () => {
  it("maps questions in order and gives new ones unique negative ids", () => {
    const { questions } = proposalToPreview(base());
    assert.deepEqual(questions.map((q) => q.id), [7, -1, 10, -2]);
    assert.deepEqual(questions.map((q) => q.title), ["Name?", "Email?", "About you", "Age?"]);
    assert.equal(questions[0].required, true);
    assert.equal(questions[0].logic, null);
  });

  it("tells children their group's title", () => {
    const { questions } = proposalToPreview(base());
    assert.equal(questions[3].group_id, 10);
    assert.equal(questions[3].group_title, "About you");
    assert.equal(questions[0].group_title ?? null, null);
  });

  it("builds endings and the thank-you from the first ending", () => {
    const { endings, thankYou } = proposalToPreview(base());
    assert.deepEqual(endings.map((e) => e.id), [3, -1]);
    assert.deepEqual(endings.map((e) => e.position), [0, 1]);
    assert.deepEqual(thankYou, { title: "Thanks!", message: "See you", button_text: "Visit", button_url: "https://example.com" });
  });

  it("shows the welcome screen only when there is a description (same rule as the public page)", () => {
    assert.equal(proposalToPreview(base()).welcome?.title, "Cafe");
    assert.equal(proposalToPreview(base()).welcome?.button_text, "Go");
    const none = base();
    none.welcome.description = "   ";
    assert.equal(proposalToPreview(none).welcome, null);
  });
});

describe("changeLabel", () => {
  const change = (c: Partial<QuestionChange>): QuestionChange => ({ id: 1, type: "short_text", title: "t", position: 0, change: "changed", fields: [], moved: false, ...c });

  it("describes new, moved and changed questions the way the review list shows them", () => {
    assert.equal(changeLabel(change({ change: "new" })), "New");
    assert.equal(changeLabel(change({ change: "moved" })), "Moved");
    assert.equal(changeLabel(change({ change: "changed", fields: ["title"] })), "Edited: title");
    assert.equal(changeLabel(change({ change: "changed", fields: ["options", "required"], moved: true })), "Edited: options, required · moved");
  });

  it("uses plain words for property names", () => {
    assert.equal(changeLabel(change({ fields: ["max", "shape"] })), "Edited: max, shape");
    assert.equal(changeLabel(change({ fields: ["allow_multiple"] })), "Edited: allow multiple");
  });
});

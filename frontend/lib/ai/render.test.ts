// Server-side render checks for the Typeform AI components: they must render (no crash, no missing text) for every state.
import assert from "node:assert/strict";
import { createElement } from "react";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AiPromptBox } from "../../components/ai/AiPromptBox";
import { ChatThread } from "../../components/ai/ChatThread";
import { ChatToCreateBar } from "../../components/ai/ChatToCreateBar";
import { SuggestedChanges } from "../../components/ai/SuggestedChanges";
import { initialSession, type Session } from "./session";
import type { Diff, Proposal } from "./types";

const noop = () => {};
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

const proposal: Proposal = {
  welcome: { title: "T", description: null, button_text: "Start", show_time_to_complete: false, show_submission_count: false },
  questions: [],
  endings: [{ id: null, title: "Bye", message: "m", button_text: null, button_url: null }],
};
const emptyDiff: Diff = { to_remove: [], to_set: [], endings: { to_remove: [], to_set: [] }, welcome: [] };
const fullDiff: Diff = {
  to_remove: [{ id: 2, type: "short_text", title: "Old question", position: 1 }],
  to_set: [
    { id: 1, type: "rating", title: "Rate us", position: 0, change: "changed", fields: ["max", "shape"], moved: false },
    { id: null, type: "email", title: "Your email?", position: 1, change: "new", fields: [], moved: false },
  ],
  endings: { to_remove: [{ id: 5, title: "Old ending", position: 1 }], to_set: [{ id: null, title: "New ending", position: 1, change: "new", fields: [], moved: false }] },
  welcome: ["title", "button_text"],
};

describe("SuggestedChanges", () => {
  it("lists removed questions, questions to set with what changed, endings and the welcome screen", () => {
    const out = html(createElement(SuggestedChanges, { diff: fullDiff }));
    for (const text of [
      "Questions to be removed", "Old question", "Questions to be set", "Rate us", "Edited: max, shape", "Your email?", "New",
      "Endings to be removed", "Old ending", "Endings to be set", "New ending", "Welcome screen", "Changed:", "title, button text",
    ]) {
      assert.ok(out.includes(text), `missing “${text}”`);
    }
  });

  it("explains the empty states", () => {
    assert.ok(html(createElement(SuggestedChanges, { diff: null })).includes("No suggestions yet"));
    assert.ok(html(createElement(SuggestedChanges, { diff: emptyDiff })).includes("Nothing to change"));
  });

  it("never shows a blank row for an untitled question", () => {
    const diff: Diff = { ...emptyDiff, to_set: [{ id: null, type: "short_text", title: "  ", position: 0, change: "new", fields: [], moved: false }] };
    assert.ok(html(createElement(SuggestedChanges, { diff })).includes("Untitled question"));
  });
});

describe("ChatThread", () => {
  const session = (patch: Partial<Session>): Session => ({ ...initialSession, ...patch });
  const render = (s: Session) => html(createElement(ChatThread, { session: s, onSend: noop, onRetry: noop, onRestore: noop }));

  it("shows both sides of the conversation and the composer", () => {
    const out = render(session({ messages: [{ role: "user", content: "make a quiz" }, { role: "assistant", content: "Done, here it is." }] }));
    assert.ok(out.includes("make a quiz") && out.includes("Done, here it is."));
    assert.ok(out.includes('aria-label="Message Typeform AI"'));
  });

  it("marks the current version and offers to restore the others", () => {
    const v = (i: number) => ({ proposal, diff: emptyDiff, reply: `r${i}`, messageIndex: i * 2 + 1 });
    const out = render(session({
      messages: [
        { role: "user", content: "a" }, { role: "assistant", content: "one" },
        { role: "user", content: "b" }, { role: "assistant", content: "two" },
      ],
      versions: [v(0), v(1)],
      current: 1,
    }));
    assert.ok(out.includes("Version 2 · shown on the right"));
    assert.ok(out.includes("Restore version 1"));
  });

  it("shows a thinking indicator; the creator can type ahead but not send until the answer is in", () => {
    const out = render(session({ messages: [{ role: "user", content: "go" }], status: "thinking" }));
    assert.ok(out.includes("Typeform AI is thinking"));
    assert.ok(!/<textarea[^>]*disabled/.test(out), "typing stays possible");
    assert.ok(/<button[^>]*aria-label="Send"[^>]*disabled|<button[^>]*disabled[^>]*aria-label="Send"/.test(out), "sending is not");
  });

  it("shows the error with a way to try again", () => {
    const out = render(session({ messages: [{ role: "user", content: "go" }], status: "error", error: "Typeform AI is busy right now (rate limit)." }));
    assert.ok(out.includes('role="alert"') && out.includes("rate limit") && out.includes("Try again"));
  });
});

describe("prompt inputs", () => {
  it("the chat bar is labelled and its send button starts disabled", () => {
    const out = html(createElement(ChatToCreateBar, { onSubmit: noop }));
    assert.ok(out.includes('aria-label="Chat to create"') && out.includes('placeholder="Chat to create"'));
    assert.ok(/<button[^>]*aria-label="Send"[^>]*disabled/.test(out) || /<button[^>]*disabled[^>]*aria-label="Send"/.test(out));
  });

  it("the big prompt box is labelled, starts empty and can't send yet", () => {
    const out = html(createElement(AiPromptBox, { onSubmit: noop }));
    assert.ok(out.includes('aria-label="Describe your form"'));
    assert.ok(/<button[^>]*disabled/.test(out));
  });
});

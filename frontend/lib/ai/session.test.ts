import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialSession, messagesForServer, sessionReducer, currentVersion, hasChanges } from "./session";
import type { ChatOut, Diff, Proposal } from "./types";

const proposal = (title: string): Proposal => ({
  welcome: { title, description: null, button_text: "Start", show_time_to_complete: false, show_submission_count: false },
  questions: [],
  endings: [{ id: null, title: "Thanks", message: "Bye", button_text: null, button_url: null }],
});
const diff = (n: number): Diff => ({
  to_remove: [],
  to_set: Array.from({ length: n }, (_, i) => ({ id: null, type: "short_text" as const, title: `Q${i}`, position: i, change: "new" as const, fields: [], moved: false })),
  endings: { to_remove: [], to_set: [] },
  welcome: [],
});
const out = (reply: string, p: Proposal | null = null, d: Diff | null = null): ChatOut => ({ reply, proposal: p, diff: d });

describe("sessionReducer", () => {
  it("sending adds the creator's message and starts thinking", () => {
    const s = sessionReducer(initialSession, { type: "send", text: "  make a survey  " });
    assert.deepEqual(s.messages, [{ role: "user", content: "make a survey" }]);
    assert.equal(s.status, "thinking");
    assert.equal(s.error, null);
  });

  it("ignores an empty message and a send while thinking", () => {
    assert.equal(sessionReducer(initialSession, { type: "send", text: "   " }), initialSession);
    const thinking = sessionReducer(initialSession, { type: "send", text: "a" });
    assert.equal(sessionReducer(thinking, { type: "send", text: "b" }), thinking);
  });

  it("a reply with a proposal becomes the current version", () => {
    let s = sessionReducer(initialSession, { type: "send", text: "go" });
    s = sessionReducer(s, { type: "reply", out: out("Here you go", proposal("v1"), diff(2)) });
    assert.equal(s.status, "idle");
    assert.deepEqual(s.messages.map((m) => m.role), ["user", "assistant"]);
    assert.equal(s.versions.length, 1);
    assert.equal(currentVersion(s)?.proposal.welcome.title, "v1");
    assert.equal(currentVersion(s)?.messageIndex, 1);   // the assistant message that produced it
    assert.equal(hasChanges(s), true);
  });

  it("a reply without a proposal keeps the current version", () => {
    let s = sessionReducer(initialSession, { type: "send", text: "go" });
    s = sessionReducer(s, { type: "reply", out: out("v1", proposal("v1"), diff(1)) });
    s = sessionReducer(s, { type: "send", text: "which is best?" });
    s = sessionReducer(s, { type: "reply", out: out("The first one.") });
    assert.equal(s.versions.length, 1);
    assert.equal(currentVersion(s)?.proposal.welcome.title, "v1");
    assert.equal(s.messages.at(-1)?.content, "The first one.");
  });

  it("restoring an earlier version selects it without losing the newer ones", () => {
    let s = initialSession;
    for (const t of ["v1", "v2", "v3"]) {
      s = sessionReducer(s, { type: "send", text: t });
      s = sessionReducer(s, { type: "reply", out: out(t, proposal(t), diff(1)) });
    }
    s = sessionReducer(s, { type: "restore", index: 0 });
    assert.equal(currentVersion(s)?.proposal.welcome.title, "v1");
    assert.equal(s.versions.length, 3);
    s = sessionReducer(s, { type: "restore", index: 2 });
    assert.equal(currentVersion(s)?.proposal.welcome.title, "v3");
    assert.equal(sessionReducer(s, { type: "restore", index: 9 }), s);  // out of range: ignored
  });

  it("a new proposal after restoring branches from the restored version", () => {
    let s = initialSession;
    for (const t of ["v1", "v2"]) {
      s = sessionReducer(s, { type: "send", text: t });
      s = sessionReducer(s, { type: "reply", out: out(t, proposal(t), diff(1)) });
    }
    s = sessionReducer(s, { type: "restore", index: 0 });
    s = sessionReducer(s, { type: "send", text: "v3" });
    s = sessionReducer(s, { type: "reply", out: out("v3", proposal("v3"), diff(1)) });
    assert.deepEqual(s.versions.map((v) => v.proposal.welcome.title), ["v1", "v3"]);  // v2 was abandoned
    assert.equal(currentVersion(s)?.proposal.welcome.title, "v3");
  });

  it("a failure keeps the conversation and offers a retry", () => {
    let s = sessionReducer(initialSession, { type: "send", text: "go" });
    s = sessionReducer(s, { type: "fail", message: "Typeform AI is busy right now" });
    assert.equal(s.status, "error");
    assert.equal(s.error, "Typeform AI is busy right now");
    assert.deepEqual(s.messages, [{ role: "user", content: "go" }]);
    s = sessionReducer(s, { type: "retry" });
    assert.equal(s.status, "thinking");
    assert.equal(s.error, null);
    assert.equal(s.messages.length, 1);                       // not duplicated
  });

  it("a proposal that changes nothing doesn't count as changes", () => {
    let s = sessionReducer(initialSession, { type: "send", text: "go" });
    s = sessionReducer(s, { type: "reply", out: out("same", proposal("v1"), diff(0)) });
    assert.equal(hasChanges(s), false);
    assert.equal(hasChanges(initialSession), false);
  });
});

describe("messagesForServer", () => {
  it("sends the whole conversation when it is short", () => {
    const m = [{ role: "user" as const, content: "a" }, { role: "assistant" as const, content: "b" }, { role: "user" as const, content: "c" }];
    assert.deepEqual(messagesForServer(m), m);
  });

  it("keeps the latest messages, starts with the creator and ends with the creator", () => {
    const m = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 === 0 ? ("user" as const) : ("assistant" as const), content: `m${i}` }));
    m.push({ role: "user" as const, content: "last" });
    const sent = messagesForServer(m);
    assert.ok(sent.length <= 30);
    assert.equal(sent[0].role, "user");
    assert.equal(sent.at(-1)?.content, "last");
  });

  it("trims over-long messages to what the server accepts", () => {
    const sent = messagesForServer([{ role: "user", content: "x".repeat(5000) }]);
    assert.equal(sent[0].content.length, 4000);
  });
});

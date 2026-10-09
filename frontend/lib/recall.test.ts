import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { options, question } from "./__fixtures__/questions";
import {
  NO_RECALL_SOURCES,
  buildRecallSources,
  formatRecallToken,
  hasRecall,
  parseRecall,
  recallGroups,
  recallLabel,
  renderRecall,
} from "./recall";

const choices = options("Red", "Green", "Blue");

describe("parseRecall", () => {
  it("splits text and tokens", () => {
    assert.deepEqual(parseRecall("Hi {{field:12}}, you have {{var:score}} points from {{param:utm_source}}!"), [
      { type: "text", text: "Hi " },
      { type: "token", raw: "{{field:12}}", token: { kind: "field", id: 12 } },
      { type: "text", text: ", you have " },
      { type: "token", raw: "{{var:score}}", token: { kind: "var", name: "score" } },
      { type: "text", text: " points from " },
      { type: "token", raw: "{{param:utm_source}}", token: { kind: "param", name: "utm_source" } },
      { type: "text", text: "!" },
    ]);
  });

  it("leaves text without tokens, and malformed tokens, as plain text", () => {
    assert.deepEqual(parseRecall("plain"), [{ type: "text", text: "plain" }]);
    assert.deepEqual(parseRecall(""), []);
    assert.deepEqual(parseRecall("{{field:abc}} {{nope:1}} {{var:}} {{field:1"), [
      { type: "text", text: "{{field:abc}} {{nope:1}} {{var:}} {{field:1" },
    ]);
  });

  it("parses adjacent tokens", () => {
    assert.deepEqual(
      parseRecall("{{var:a}}{{var:b}}").map((s) => s.type),
      ["token", "token"],
    );
  });

  it("round-trips through formatRecallToken", () => {
    for (const raw of ["{{field:7}}", "{{var:score}}", "{{param:email}}"]) {
      const [segment] = parseRecall(raw);
      assert.equal(segment.type === "token" && formatRecallToken(segment.token), raw);
    }
  });

  it("knows whether a text has any recall", () => {
    assert.equal(hasRecall("a {{var:score}}"), true);
    assert.equal(hasRecall("a {{var:Score}}"), false);
    assert.equal(hasRecall(""), false);
  });
});

describe("renderRecall", () => {
  const name = question("short_text");
  const color = question("multiple_choice", { options: choices, allow_multiple: true });
  const age = question("number");
  const later = question("short_text");
  const all = [name, color, age, later];

  it("replaces field answers with the type's display text (choices show their labels)", () => {
    const ctx = { questions: all, answers: { [name.id]: "Ann", [color.id]: ["a", "c"], [age.id]: 1234.5 } };
    assert.equal(renderRecall(`Hi {{field:${name.id}}}`, ctx), "Hi Ann");
    assert.equal(renderRecall(`You like {{field:${color.id}}}`, ctx), "You like Red, Blue");
    assert.equal(renderRecall(`{{field:${age.id}}} years`, ctx), "1,234.5 years");
  });

  it("renders unanswered, unknown and off-path references as empty text", () => {
    const ctx = { questions: all, answers: { [name.id]: "Ann", [later.id]: "x" }, path: [name.id, color.id] };
    assert.equal(renderRecall(`[{{field:${color.id}}}]`, ctx), "[]");
    assert.equal(renderRecall("[{{field:99999}}]", ctx), "[]");
    assert.equal(renderRecall(`[{{field:${later.id}}}]`, ctx), "[]", "answered but skipped by branching");
    assert.equal(renderRecall("[{{var:nope}}] [{{param:nope}}]", ctx), "[] []");
  });

  it("renders variables (numbers without float noise) and URL parameters as text", () => {
    const ctx = { variables: { score: 0.1 + 0.2, tag: "vip" }, params: { utm_source: "<b>news</b>" } };
    assert.equal(renderRecall("{{var:score}} / {{var:tag}} / {{param:utm_source}}", ctx), "0.3 / vip / <b>news</b>");
    assert.equal(renderRecall("{{var:score}}", { variables: { score: 150 } }), "150");
  });

  it("returns text without tokens untouched, and works with an empty context", () => {
    assert.equal(renderRecall("Hello {{field:1}}", {}), "Hello ");
    assert.equal(renderRecall("Hello", {}), "Hello");
  });
});

describe("recall sources and the picker", () => {
  const first = question("short_text", {}, { title: "Name?" });
  const note = question("statement", {}, { title: "Just so you know" });
  const second = question("multiple_choice", { options: choices }, { title: "Color?" });
  const third = question("number", {}, { title: "Age?" });
  const form = {
    questions: [first, note, second, third],
    variables: [{ name: "score" }, { name: "level" }],
    url_parameters: ["utm_source", "email"],
  };

  it("lists answerable questions before a question, with their display numbers", () => {
    const sources = buildRecallSources(form, { before: third.id });
    assert.deepEqual(
      sources.questions.map((q) => [q.id, q.number, q.title]),
      [
        [first.id, 1, "Name?"],
        [second.id, 3, "Color?"],
      ],
    );
    assert.deepEqual(sources.variables, ["score", "level"]);
    assert.deepEqual(sources.params, ["utm_source", "email"]);
  });

  it("lists every answerable question for an ending, and none for the welcome screen", () => {
    assert.equal(buildRecallSources(form).questions.length, 3);
    const welcome = buildRecallSources(form, { questions: false });
    assert.deepEqual(welcome.questions, []);
    assert.deepEqual(welcome.variables, ["score", "level"]);
  });

  it("groups the options as Typeform's picker does and filters as you type", () => {
    const sources = buildRecallSources(form, { before: third.id });
    const groups = recallGroups(sources);
    assert.deepEqual(
      groups.map((g) => g.group),
      ["Questions", "Variables", "URL parameters"],
    );
    assert.deepEqual(groups[0].options.map((o) => o.token), [`{{field:${first.id}}}`, `{{field:${second.id}}}`]);
    assert.deepEqual(groups[1].options.map((o) => o.token), ["{{var:score}}", "{{var:level}}"]);
    assert.deepEqual(groups[2].options.map((o) => o.token), ["{{param:utm_source}}", "{{param:email}}"]);

    const filtered = recallGroups(sources, "co");
    assert.deepEqual(filtered.map((g) => g.group), ["Questions"], "Color? only");
    assert.deepEqual(recallGroups(sources, "zzz"), []);
    assert.deepEqual(recallGroups(NO_RECALL_SOURCES), []);
  });

  it("labels a token for its pill", () => {
    const sources = buildRecallSources(form, { before: third.id });
    assert.equal(recallLabel({ kind: "field", id: first.id }, sources), "Name?");
    assert.equal(recallLabel({ kind: "var", name: "score" }, sources), "score");
    assert.equal(recallLabel({ kind: "param", name: "email" }, sources), "email");
    assert.equal(recallLabel({ kind: "field", id: third.id }, sources), null, "not available here");
  });
});

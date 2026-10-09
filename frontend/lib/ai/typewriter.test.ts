import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextTypewriterStep, TYPEWRITER_PHRASES } from "./typewriter";

const run = (phrases: string[], steps: number) => {
  let state = { phrase: 0, shown: 0, phase: "typing" as const } as ReturnType<typeof nextTypewriterStep>["state"];
  const seen: { text: string; delay: number; phase: string }[] = [];
  for (let i = 0; i < steps; i++) {
    const step = nextTypewriterStep(state, phrases);
    state = step.state;
    seen.push({ text: phrases[state.phrase].slice(0, state.shown), delay: step.delay, phase: state.phase });
  }
  return seen;
};

describe("typewriter", () => {
  it("types one character per step (50 ms)", () => {
    const seen = run(["abc"], 3);
    assert.deepEqual(seen.map((s) => s.text), ["a", "ab", "abc"]);
    assert.ok(seen.slice(0, 2).every((s) => s.delay === 50));
  });

  it("holds the finished phrase for about two seconds, then deletes", () => {
    const seen = run(["ab"], 4);
    assert.equal(seen[1].text, "ab");
    assert.equal(seen[1].phase, "holding");
    assert.equal(seen[1].delay, 2000);
    assert.equal(seen[2].phase, "deleting");
    assert.ok(seen[2].text.length < 2);
  });

  it("waits briefly when empty and moves on to the next phrase", () => {
    const seen = run(["ab", "cd"], 12);
    const empty = seen.findIndex((s) => s.text === "" && s.phase === "waiting");
    assert.ok(empty >= 0);
    assert.equal(seen[empty].delay, 450);
    assert.ok(seen.slice(empty + 1).some((s) => s.text.startsWith("c")));
  });

  it("cycles back to the first phrase", () => {
    const seen = run(["a", "b"], 30);
    assert.ok(seen.filter((s) => s.text === "a").length >= 2);
  });

  it("uses Typeform's two prompts", () => {
    assert.deepEqual(TYPEWRITER_PHRASES, ["Explain the goal of your form.", "Type or paste your form questions."]);
  });
});

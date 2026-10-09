import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ONBOARDING_STORAGE_KEY, parseOnboarding } from "./onboarding";
import { ONBOARDING_PENDING_ATTRIBUTE, ONBOARDING_SCRIPT } from "./onboardingScript";

/** Runs the inline <head> script against a fake browser; reports whether it marked the page and what the timer does. */
function run(stored: string | null | "throws") {
  const attributes = new Map<string, string>();
  const timers: { fn: () => void; ms: number }[] = [];
  const localStorage = {
    getItem: (key: string) => {
      if (stored === "throws") throw new Error("blocked");
      return key === ONBOARDING_STORAGE_KEY ? stored : null;
    },
  };
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    },
  };
  const setTimeout = (fn: () => void, ms: number) => timers.push({ fn, ms });
  new Function("localStorage", "document", "setTimeout", ONBOARDING_SCRIPT)(localStorage, document, setTimeout);
  return { pending: attributes.get(ONBOARDING_PENDING_ATTRIBUTE), timers, attributes };
}

const completed = JSON.stringify({ v: 1, status: "completed", completedAt: "2026-10-09T00:00:00.000Z", name: "Ana", role: null, goals: [] });
const skipped = JSON.stringify({ v: 1, status: "skipped", completedAt: "2026-10-09T00:00:00.000Z" });

describe("the first-paint check for the intro", () => {
  it("marks a visitor who has never seen it", () => {
    assert.equal(run(null).pending, "unseen");
  });

  it("leaves visitors alone who finished or skipped it", () => {
    assert.equal(run(completed).pending, undefined);
    assert.equal(run(skipped).pending, undefined);
  });

  it("treats corrupt, old-version or nameless storage as unseen, like the app does", () => {
    const bad = [
      "not json",
      "[]",
      "null",
      "42",
      JSON.stringify({ v: 2, status: "skipped" }),
      JSON.stringify({ v: 1, status: "completed", name: "  " }),
      JSON.stringify({ v: 1, status: "wat" }),
    ];
    for (const raw of bad) assert.equal(run(raw).pending, "unseen", raw);
  });

  it("treats blocked storage as unseen (the app keeps the state in memory then)", () => {
    assert.equal(run("throws").pending, "unseen");
  });

  it("always agrees with parseOnboarding", () => {
    const samples = [null, completed, skipped, "not json", "{}", JSON.stringify({ v: 1, status: "completed", name: "x" })];
    for (const raw of samples) {
      assert.equal(run(raw).pending === "unseen", parseOnboarding(raw).status === "unseen", String(raw));
    }
  });

  it("lets go of the page after 5 seconds if nothing else did", () => {
    const { timers, attributes } = run(null);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 5000);
    timers[0].fn();
    assert.equal(attributes.has(ONBOARDING_PENDING_ATTRIBUTE), false);
  });
});

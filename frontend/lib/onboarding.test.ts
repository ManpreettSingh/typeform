import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOALS,
  ONBOARDING_STORAGE_KEY,
  ROLES,
  avatarLetter,
  completedProfile,
  createOnboardingStore,
  displayName,
  initialsOf,
  parseOnboarding,
  serializeOnboarding,
  suggestedPrompt,
  type StorageLike,
} from "./onboarding";

const NOW = new Date("2026-10-09T10:00:00.000Z");

describe("completedProfile", () => {
  it("keeps a clean name, a known role and up to three known goals", () => {
    const s = completedProfile({ name: "  Ana  Lopez ", role: "marketing", goals: ["feedback", "leads", "events", "recruit"] }, NOW);
    assert.deepEqual(s, { status: "completed", completedAt: NOW.toISOString(), name: "Ana Lopez", role: "marketing", goals: ["feedback", "leads", "events"] });
  });

  it("drops unknown roles and goals and duplicate goals", () => {
    const s = completedProfile({ name: "Ana", role: "wizard", goals: ["feedback", "feedback", "nonsense"] }, NOW);
    assert.equal(s.status === "completed" && s.role, null);
    assert.deepEqual(s.status === "completed" && s.goals, ["feedback"]);
  });

  it("limits the name to 40 characters and falls back to skipped when it is empty", () => {
    const long = completedProfile({ name: "x".repeat(80), role: null, goals: [] }, NOW);
    assert.equal(long.status === "completed" && long.name.length, 40);
    assert.equal(completedProfile({ name: "   ", role: "product", goals: [] }, NOW).status, "skipped");
  });
});

describe("parse / serialize", () => {
  it("round-trips a completed profile and a skipped one", () => {
    const done = completedProfile({ name: "Ana", role: "sales", goals: ["leads"] }, NOW);
    assert.deepEqual(parseOnboarding(serializeOnboarding(done)), done);
    const skipped = { status: "skipped" as const, completedAt: NOW.toISOString() };
    assert.deepEqual(parseOnboarding(serializeOnboarding(skipped)), skipped);
  });

  it("treats missing, corrupt, wrong-shaped and newer-version data as not seen", () => {
    for (const raw of [null, "", "not json", "[]", "null", "42", '{"v":1}', '{"v":99,"status":"completed","name":"A"}', '{"v":1,"status":"completed"}']) {
      assert.deepEqual(parseOnboarding(raw), { status: "unseen" }, String(raw));
    }
  });

  it("re-validates stored values, so edited storage can't smuggle junk into the UI", () => {
    const raw = JSON.stringify({ v: 1, status: "completed", completedAt: NOW.toISOString(), name: "<b>Ana</b>".repeat(20), role: "hacker", goals: ["feedback", 7, "leads", "x", "events", "recruit"] });
    const s = parseOnboarding(raw);
    assert.equal(s.status, "completed");
    if (s.status !== "completed") return;
    assert.equal(s.name.length, 40);
    assert.equal(s.role, null);
    assert.deepEqual(s.goals, ["feedback", "leads", "events"]);
  });
});

describe("names", () => {
  it("makes initials from the first and last word, or the first two letters of a single word", () => {
    assert.equal(initialsOf("Ana Maria Lopez"), "AL");
    assert.equal(initialsOf("ana"), "AN");
    assert.equal(initialsOf("  éva  "), "ÉV");
    assert.equal(initialsOf("X"), "X");
    assert.equal(initialsOf("   "), "DC");
  });

  it("handles characters outside the basic plane without splitting them", () => {
    assert.equal(initialsOf("🙂 Smile"), "🙂S");
  });

  it("shows the profile's name and letter, or the default creator", () => {
    const done = completedProfile({ name: "ana lopez", role: null, goals: [] }, NOW);
    assert.equal(displayName(done), "ana lopez");
    assert.equal(avatarLetter(done), "A");
    assert.equal(displayName({ status: "unseen" }), "Default creator");
    assert.equal(displayName({ status: "skipped", completedAt: "" }), "Default creator");
    assert.equal(avatarLetter({ status: "unseen" }), "D");
  });
});

describe("suggestedPrompt", () => {
  const base = { status: "completed" as const, completedAt: NOW.toISOString(), name: "Ana" };

  it("builds a request from the role and the first goal", () => {
    assert.equal(suggestedPrompt({ ...base, role: "marketing", goals: ["feedback"] }), "Create a customer feedback survey for a marketing team.");
    assert.equal(suggestedPrompt({ ...base, role: "hr", goals: ["recruit", "feedback"] }), "Create a job application form for an HR team.");
  });

  it("has a sensible default without a role or goals", () => {
    assert.equal(suggestedPrompt({ ...base, role: null, goals: [] }), "Create a customer feedback survey for my project.");
    assert.equal(suggestedPrompt({ status: "unseen" }), "Create a customer feedback survey for my project.");
  });

  it("every role and goal has a label and the words the prompt needs", () => {
    for (const r of ROLES) assert.ok(r.label && r.audience, r.id);
    for (const g of GOALS) assert.ok(g.label && g.phrase, g.id);
    assert.equal(new Set(ROLES.map((r) => r.id)).size, ROLES.length);
    assert.equal(new Set(GOALS.map((g) => g.id)).size, GOALS.length);
  });
});

function fakeStorage(initial: Record<string, string> = {}, opts: { throws?: boolean } = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  const guard = () => {
    if (opts.throws) throw new Error("denied");
  };
  return {
    data,
    getItem: (k) => (guard(), data[k] ?? null),
    setItem: (k, v) => (guard(), void (data[k] = v)),
    removeItem: (k) => (guard(), void delete data[k]),
  };
}

describe("createOnboardingStore", () => {
  it("starts unseen, saves, and reads back", () => {
    const storage = fakeStorage();
    const store = createOnboardingStore(() => storage);
    assert.deepEqual(store.get(), { status: "unseen" });
    const done = completedProfile({ name: "Ana", role: "product", goals: ["research"] }, NOW);
    store.set(done);
    assert.deepEqual(store.get(), done);
    assert.ok(storage.data[ONBOARDING_STORAGE_KEY]);
  });

  it("returns the same object until the data changes (needed by useSyncExternalStore)", () => {
    const store = createOnboardingStore(() => fakeStorage());
    assert.equal(store.get(), store.get());
    store.set({ status: "skipped", completedAt: NOW.toISOString() });
    assert.equal(store.get(), store.get());
  });

  it("notifies subscribers on set and reset, and stops after unsubscribe", () => {
    const store = createOnboardingStore(() => fakeStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ status: "skipped", completedAt: NOW.toISOString() });
    store.reset();
    assert.equal(calls, 2);
    assert.deepEqual(store.get(), { status: "unseen" });
    off();
    store.set({ status: "skipped", completedAt: NOW.toISOString() });
    assert.equal(calls, 2);
  });

  it("keeps working in memory when storage is blocked (private mode)", () => {
    const store = createOnboardingStore(() => fakeStorage({}, { throws: true }));
    assert.deepEqual(store.get(), { status: "unseen" });
    store.set({ status: "skipped", completedAt: NOW.toISOString() });
    assert.equal(store.get().status, "skipped");
    store.reset();
    assert.equal(store.get().status, "unseen");
  });

  it("works with no storage at all (server render)", () => {
    const store = createOnboardingStore(() => null);
    assert.deepEqual(store.get(), { status: "unseen" });
    store.set({ status: "skipped", completedAt: NOW.toISOString() });
    assert.equal(store.get().status, "skipped");
  });

  it("notices a change made in another tab", () => {
    const storage = fakeStorage();
    const listeners: Array<(e: { key: string | null }) => void> = [];
    const store = createOnboardingStore(() => storage, {
      addStorageListener: (fn) => {
        listeners.push(fn);
        return () => void listeners.splice(listeners.indexOf(fn), 1);
      },
    });
    let calls = 0;
    const off = store.subscribe(() => calls++);
    assert.equal(store.get().status, "unseen");
    storage.data[ONBOARDING_STORAGE_KEY] = serializeOnboarding({ status: "skipped", completedAt: NOW.toISOString() });
    listeners.forEach((fn) => fn({ key: ONBOARDING_STORAGE_KEY }));
    assert.equal(calls, 1);
    assert.equal(store.get().status, "skipped");
    listeners.forEach((fn) => fn({ key: "something-else" }));   // unrelated keys are ignored
    assert.equal(calls, 1);
    off();
    assert.equal(listeners.length, 0);
  });
});

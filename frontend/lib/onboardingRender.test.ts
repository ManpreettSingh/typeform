// Server-side render checks for the onboarding screens and the mapping from the intro's answers to a profile.
import assert from "node:assert/strict";
import { createElement } from "react";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountChip, AccountInitials } from "../components/dashboard/AccountMenu";
import { OnboardingDone } from "../components/onboarding/OnboardingDone";
import { profileFromAnswers } from "../components/onboarding/OnboardingExperience";
import { ONBOARDING_QUESTIONS, Q_GOALS, Q_NAME, Q_ROLE } from "../components/onboarding/onboardingQuestions";
import { GOALS, ROLES, completedProfile } from "./onboarding";

const NOW = new Date("2026-10-09T10:00:00.000Z");
const noop = () => {};
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe("profileFromAnswers", () => {
  it("turns the intro's answers into a completed profile", () => {
    const p = profileFromAnswers({ [Q_NAME]: "  Ana Lopez ", [Q_ROLE]: "marketing", [Q_GOALS]: ["feedback", "leads"] });
    assert.equal(p.status, "completed");
    if (p.status !== "completed") return;
    assert.deepEqual([p.name, p.role, p.goals], ["Ana Lopez", "marketing", ["feedback", "leads"]]);
  });

  it("copes with skipped optional questions and odd values", () => {
    const p = profileFromAnswers({ [Q_NAME]: "Ana" });
    assert.deepEqual(p.status === "completed" && [p.role, p.goals], [null, []]);
    const junk = profileFromAnswers({ [Q_NAME]: "Ana", [Q_ROLE]: 5, [Q_GOALS]: ["leads", 3, null] } as unknown as Parameters<typeof profileFromAnswers>[0]);
    assert.deepEqual(junk.status === "completed" && [junk.role, junk.goals], [null, ["leads"]]);
    assert.equal(profileFromAnswers({}).status, "skipped");
  });
});

describe("the intro's questions", () => {
  it("are three, the name is required and the goals are capped at three", () => {
    assert.equal(ONBOARDING_QUESTIONS.length, 3);
    const [name, role, goals] = ONBOARDING_QUESTIONS;
    assert.deepEqual([name.id, role.id, goals.id], [Q_NAME, Q_ROLE, Q_GOALS]);
    assert.equal(name.required, true);
    assert.equal(role.required, false);
    const props = goals.properties as { options: { id: string }[]; allow_multiple: boolean; max_selections: number };
    assert.equal(props.allow_multiple, true);
    assert.equal(props.max_selections, 3);
    assert.deepEqual(props.options.map((o) => o.id), GOALS.map((g) => g.id));
    assert.deepEqual((role.properties as { options: { id: string }[] }).options.map((o) => o.id), ROLES.map((r) => r.id));
  });
});

describe("OnboardingDone", () => {
  const profile = completedProfile({ name: "Ana Lopez", role: "marketing", goals: ["feedback", "leads"] }, NOW);

  it("greets by first name, shows what was picked and the AI's suggestion", () => {
    const out = html(createElement(OnboardingDone, { profile, onCreateWithAi: noop, onExplore: noop }));
    for (const text of ["You&#x27;re all set, Ana!", "Marketing", "Get feedback", "Generate leads", "Typeform AI suggests", "Create a customer feedback survey for a marketing team.", "Create my first form with AI", "Explore my workspace"]) {
      assert.ok(out.includes(text), `missing “${text}”`);
    }
  });

  it("still works for a profile without a name", () => {
    const out = html(createElement(OnboardingDone, { profile: { status: "skipped", completedAt: NOW.toISOString() }, onCreateWithAi: noop, onExplore: noop }));
    assert.ok(out.includes("You&#x27;re all set!") && !out.includes("undefined") && out.includes("for my project"));
  });
});

describe("account chip", () => {
  it("shows the visitor's name and initials", () => {
    const state = completedProfile({ name: "Ana Lopez", role: null, goals: [] }, NOW);
    const chip = html(createElement(AccountChip, { state }));
    assert.ok(chip.includes("Ana Lopez") && chip.includes(">A<") && !chip.includes("invisible"));
    assert.ok(html(createElement(AccountInitials, { state })).includes(">AL<"));
  });

  it("shows Default creator when the intro was skipped or not seen", () => {
    const chip = html(createElement(AccountChip, { state: { status: "unseen" } }));
    assert.ok(chip.includes("Default creator") && chip.includes(">D<"));
    assert.ok(html(createElement(AccountInitials, { state: { status: "skipped", completedAt: "" } })).includes(">DC<"));
  });

  it("keeps its space but shows nothing while localStorage hasn't been read (no wrong-name flash)", () => {
    const chip = html(createElement(AccountChip, { state: { status: "loading" } }));
    assert.ok(chip.includes("invisible"));
    assert.ok(html(createElement(AccountInitials, { state: { status: "loading" } })).includes("invisible"));
  });
});

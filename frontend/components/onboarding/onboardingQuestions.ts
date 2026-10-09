import { GOALS, ROLES } from "@/lib/onboarding";
import type { PublicQuestion, Theme } from "@/lib/types";

/** Question ids of the intro; the answers come back keyed by these. */
export const Q_NAME = 1;
export const Q_ROLE = 2;
export const Q_GOALS = 3;

/** Deep ink with Typeform AI's lilac as the accent, so the intro is unmistakably "ours". */
export const ONBOARDING_THEME: Theme = {
  question: "#faf6fc",
  answer: "#e7d3f3",
  button: "#ddb7f0",
  background: "#1d1722",
  font: "Inter",
  background_image: null,
};

export const ONBOARDING_WELCOME = {
  title: "Welcome! Let's set up your workspace.",
  description: "Three quick questions to make this space yours. It takes about 30 seconds.",
  button_text: "Let's go",
};

const base = { logic: null, group_id: null, group_title: null } as const;
const choice = (items: readonly { id: string; label: string }[]) => items.map(({ id, label }) => ({ id, label }));

/** The intro is a real form, rendered by the same engine as every form made here. */
export const ONBOARDING_QUESTIONS = [
  {
    ...base,
    id: Q_NAME,
    type: "short_text",
    title: "First, what should we call you?",
    description: "We'll use it to personalize your workspace.",
    required: true,
    properties: { placeholder: "Your name", max_length: 40 },
  },
  {
    ...base,
    id: Q_ROLE,
    type: "multiple_choice",
    title: "What best describes your role?",
    description: null,
    required: false,
    properties: { options: choice(ROLES), allow_multiple: false, allow_other: false, none_of_the_above: false, randomize: false },
  },
  {
    ...base,
    id: Q_GOALS,
    type: "multiple_choice",
    title: "What do you want to do first?",
    description: "Choose up to 3.",
    required: false,
    properties: {
      options: choice(GOALS),
      allow_multiple: true,
      allow_other: false,
      none_of_the_above: false,
      randomize: false,
      max_selections: 3,
    },
  },
] as unknown as PublicQuestion[];

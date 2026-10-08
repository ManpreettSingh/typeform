// Client-side answer validation. Mirrors the server rules in docs/API_SPEC.md; the server stays authoritative.
import { visitedPath } from "@/lib/logic";
import type { AnswerValue, Answers, PublicQuestion, SubmissionIn } from "@/lib/types";

// RFC-lite: something@something.tld, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmptyAnswer(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Returns an error message, or null when the answer is acceptable. */
export function validateAnswer(question: PublicQuestion, value: AnswerValue | undefined): string | null {
  if (isEmptyAnswer(value)) return question.required ? "Please fill this in" : null;

  switch (question.type) {
    case "short_text":
    case "long_text": {
      const max = question.properties.max_length;
      if (typeof value !== "string") return "Please enter some text";
      return max && value.length > max ? `Please keep it under ${max} characters` : null;
    }
    case "email":
      return typeof value === "string" && EMAIL.test(value.trim()) ? null : "Hmm… that email doesn't look right";
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n)) return "Please enter a number";
      const { min, max } = question.properties;
      if (min !== undefined && n < min) return `Please enter a number of ${min} or more`;
      if (max !== undefined && n > max) return `Please enter a number of ${max} or less`;
      return null;
    }
    case "rating":
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= question.properties.max
        ? null
        : "Please choose a rating";
    case "yes_no":
      return typeof value === "boolean" ? null : "Please choose Yes or No";
    case "multiple_choice": {
      const ids = new Set(question.properties.options.map((o) => o.id));
      const picked = Array.isArray(value) ? value : [value];
      if (!question.properties.allow_multiple && picked.length > 1) return "Please choose one option";
      return picked.every((id) => typeof id === "string" && ids.has(id)) ? null : "Please choose from the options";
    }
    case "dropdown":
      return question.properties.options.some((o) => o.id === value) ? null : "Please choose from the list";
  }
}

/**
 * Request body for a submission: only questions on the respondent's path (branching), empty answers dropped,
 * text trimmed, numbers as numbers.
 */
export function toSubmission(questions: PublicQuestion[], answers: Answers): SubmissionIn {
  const out: SubmissionIn["answers"] = {};
  for (const question of visitedPath(questions, answers).map((i) => questions[i])) {
    const value = answers[question.id];
    if (value === undefined || isEmptyAnswer(value)) continue;
    if (question.type === "number") out[question.id] = Number(value);
    else out[question.id] = typeof value === "string" ? value.trim() : value;
  }
  return { answers: out };
}

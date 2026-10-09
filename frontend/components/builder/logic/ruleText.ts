import { optionLetter } from "@/lib/questionTypes";
import { formatDate } from "@/lib/questionTypes/dates";
import type { LogicRule, LogicValue, Question, QuestionType } from "@/lib/types";

export const questionLabel = (questions: Question[], id: number) => {
  const index = questions.findIndex((q) => q.id === id);
  if (index === -1) return "a deleted question";
  return `${index + 1}. ${questions[index].title.trim() || "Untitled question"}`;
};

export function targetLabel(questions: Question[], to: LogicRule["to"]) {
  return to === "end" ? "End of form" : questionLabel(questions, to);
}

export function valueLabel(question: Question, value: LogicValue): string {
  switch (question.type) {
    case "multiple_choice":
    case "dropdown": {
      const index = question.properties.options.findIndex((o) => o.id === value);
      if (index === -1) return "a removed choice";
      return `${optionLetter(index)}. ${question.properties.options[index].label || `Choice ${index + 1}`}`;
    }
    case "yes_no":
      return value ? "Yes" : "No";
    case "legal":
      return value ? "Accepted" : "Declined";
    case "checkbox":
      return value ? "Checked" : "Unchecked";
    case "date":
      return formatDate(value, question.properties);
    case "short_text":
    case "long_text":
    case "email":
      return `“${String(value)}”`;
    default:
      return String(value);
  }
}

/** Why a saved rule won't do anything at fill time (it's skipped), or null when it's fine. */
export function ruleProblem(questions: Question[], question: Question, rule: LogicRule): string | null {
  if (
    (question.type === "multiple_choice" || question.type === "dropdown") &&
    !question.properties.options.some((o) => o.id === rule.value)
  ) {
    return "That choice was removed, so this rule never applies.";
  }
  if (rule.to === "end") return null;
  const from = questions.findIndex((q) => q.id === question.id);
  const to = questions.findIndex((q) => q.id === rule.to);
  if (to === -1) return "The target question was deleted.";
  if (to <= from) return "Jumps only go forward. This rule is skipped until the target comes after this question.";
  return null;
}

/** A rule the server will accept (local drafts can be half-typed, e.g. "-" in a number field). */
export function isCompleteRule(type: QuestionType, rule: LogicRule): boolean {
  switch (type) {
    case "number":
    case "rating":
    case "opinion_scale":
    case "nps":
      return typeof rule.value === "number" && Number.isFinite(rule.value);
    case "yes_no":
    case "legal":
    case "checkbox":
      return typeof rule.value === "boolean";
    default:
      return typeof rule.value === "string" && rule.value.trim() !== "";
  }
}

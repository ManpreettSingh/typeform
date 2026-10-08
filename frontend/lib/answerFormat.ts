// Display text for stored answers (results table, response drawer). Mirrors backend services/export.py.
import type { AnswerValue, PublicQuestion } from "@/lib/types";

const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** Labels for the option ids in a choice answer; ids removed since the response show as such. */
function optionLabels(question: PublicQuestion, value: AnswerValue): string[] {
  if (question.type !== "multiple_choice" && question.type !== "dropdown") return [];
  const ids = Array.isArray(value) ? value : [String(value)];
  return ids.map((id) => {
    const option = question.properties.options.find((o) => o.id === id);
    if (!option) return "(removed choice)";
    return option.label || "(untitled choice)";
  });
}

export function formatAnswer(question: PublicQuestion, value: AnswerValue | undefined): string {
  if (value === undefined || value === null) return "";
  switch (question.type) {
    case "yes_no":
      return value ? "Yes" : "No";
    case "multiple_choice":
    case "dropdown":
      return optionLabels(question, value).join(", ");
    case "rating":
      return `${value}/${question.properties.max}`;
    case "number":
      return typeof value === "number" ? formatNumber(value) : String(value);
    default:
      return String(value);
  }
}

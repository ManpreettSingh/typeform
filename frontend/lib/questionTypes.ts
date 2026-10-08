import {
  AlignLeft,
  ChevronDown,
  CircleSlash,
  Equal,
  Hash,
  ListChecks,
  Mail,
  Star,
  type LucideIcon,
} from "lucide-react";
import { QUESTION_TYPES, type QuestionType } from "@/lib/types";

export type QuestionTypeMeta = {
  label: string;
  icon: LucideIcon;
  /** Chip classes; literal strings so Tailwind generates them (tokens in globals.css). */
  chip: string;
};

// Colors follow Typeform's groups: text = blue, choice (incl. yes/no) = lavender, rating = green,
// contact = pink, other = yellow. Icons and numbers on a chip are always the same dark ink.
export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  short_text: { label: "Short Text", icon: Equal, chip: "bg-qt-text text-qt-fg" },
  long_text: { label: "Long Text", icon: AlignLeft, chip: "bg-qt-text text-qt-fg" },
  multiple_choice: { label: "Multiple Choice", icon: ListChecks, chip: "bg-qt-choice text-qt-fg" },
  dropdown: { label: "Dropdown", icon: ChevronDown, chip: "bg-qt-choice text-qt-fg" },
  email: { label: "Email", icon: Mail, chip: "bg-qt-contact text-qt-fg" },
  number: { label: "Number", icon: Hash, chip: "bg-qt-other text-qt-fg" },
  yes_no: { label: "Yes/No", icon: CircleSlash, chip: "bg-qt-choice text-qt-fg" },
  rating: { label: "Rating", icon: Star, chip: "bg-qt-rating text-qt-fg" },
};

export const QUESTION_TYPE_LIST = QUESTION_TYPES.map((type) => ({ type, ...QUESTION_TYPE_META[type] }));

/** A, B, C … Z, AA, AB … — Typeform-style choice keys. */
export function optionLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Matches the server's option id format (8 hex chars). */
export function newOptionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

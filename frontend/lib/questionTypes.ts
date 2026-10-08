import {
  AlignLeft,
  ChevronDownCircle,
  Hash,
  ListChecks,
  Mail,
  Star,
  ThumbsUp,
  Type,
  type LucideIcon,
} from "lucide-react";
import { QUESTION_TYPES, type QuestionType } from "@/lib/types";

export type QuestionTypeMeta = {
  label: string;
  icon: LucideIcon;
  /** Chip classes; literal strings so Tailwind generates them (tokens in globals.css). */
  chip: string;
};

export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  short_text: { label: "Short Text", icon: Type, chip: "bg-qt-text text-qt-text-fg" },
  long_text: { label: "Long Text", icon: AlignLeft, chip: "bg-qt-text text-qt-text-fg" },
  multiple_choice: { label: "Multiple Choice", icon: ListChecks, chip: "bg-qt-choice text-qt-choice-fg" },
  dropdown: { label: "Dropdown", icon: ChevronDownCircle, chip: "bg-qt-choice text-qt-choice-fg" },
  email: { label: "Email", icon: Mail, chip: "bg-qt-contact text-qt-contact-fg" },
  number: { label: "Number", icon: Hash, chip: "bg-qt-number text-qt-number-fg" },
  yes_no: { label: "Yes/No", icon: ThumbsUp, chip: "bg-qt-yesno text-qt-yesno-fg" },
  rating: { label: "Rating", icon: Star, chip: "bg-qt-number text-qt-number-fg" },
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

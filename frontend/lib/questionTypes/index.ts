// The question-type registry (frontend half). One definition per type: how it looks in menus, how its answers are
// validated, shown and compared. Mirrors backend/app/question_types; the server stays authoritative.
// Pure data and logic only: React components for each type live in components/questionTypes.
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  CircleSlash,
  Equal,
  Gauge,
  Globe,
  Hash,
  ListChecks,
  Mail,
  Phone,
  Scale,
  SlidersHorizontal,
  SquareCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { dateKey, formatDate, validateDate } from "./dates";
import { NPS_RANGE, isStepInRange, scaleRange } from "./scales";
import {
  QUESTION_TYPES,
  type AnswerValue,
  type LogicOp,
  type LogicRule,
  type PublicQuestionOf,
  type QuestionType,
} from "@/lib/types";

export type QuestionGroup = "contact" | "choice" | "rating" | "text" | "other" | "structure";

export type QuestionTypeDef<T extends QuestionType = QuestionType> = {
  label: string;
  icon: LucideIcon;
  /** Chip classes; literal strings so Tailwind generates them (tokens in globals.css). */
  chip: string;
  group: QuestionGroup;
  /** False for blocks that take no answer (statement, group). */
  answerable: boolean;
  /** What a required question says when left unanswered; absent → "Please fill this in". */
  requiredMessage?: string;
  /** False when a valid answer still doesn't answer a required question ("I don’t accept"). */
  satisfiesRequired?(value: AnswerValue): boolean;
  /** Conditions a branching rule can use, in menu order (same as the server's `logic_ops`). */
  ops: LogicOp[];
  /** Error for a non-empty answer, or null when it is acceptable. Mirrors the server's `validate`. */
  validate(question: PublicQuestionOf<T>, value: AnswerValue): string | null;
  /** Wording for conditions that read differently for this type (dates: "is before" instead of "is less than"). */
  opLabels?: Partial<Record<LogicOp, string>>;
  /** Display text for a stored answer (results table and drawer). */
  format(question: PublicQuestionOf<T>, value: AnswerValue): string;
  /** Whether a branching rule applies to a non-empty answer. */
  ruleMatches(rule: LogicRule, value: AnswerValue): boolean;
  /** The value sent to the server for a non-empty answer (text trimmed, numbers as numbers, phones as E.164). */
  toSubmission(question: PublicQuestionOf<T>, value: AnswerValue): AnswerValue;
};

// ---- shared helpers -------------------------------------------------------

const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

// RFC-lite: something@something.tld, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHOICE_OPS: LogicOp[] = ["is", "is_not"];
const NUMBER_OPS: LogicOp[] = ["eq", "neq", "lt", "lte", "gt", "gte"];
const TEXT_OPS: LogicOp[] = ["is", "is_not", "contains"];
const DATE_OPS: LogicOp[] = ["is", "is_not", "lt", "lte", "gt", "gte"];

function toNumber(value: unknown): number | null {
  if (typeof value === "boolean") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function matchText(rule: LogicRule, value: AnswerValue): boolean {
  const a = String(value).trim().toLowerCase();
  const b = String(rule.value).trim().toLowerCase();
  const results: Partial<Record<LogicOp, boolean>> = { is: a === b, is_not: a !== b, contains: a.includes(b) };
  return results[rule.op] ?? false;
}

function matchNumber(rule: LogicRule, value: AnswerValue): boolean {
  const a = toNumber(value);
  const b = toNumber(rule.value);
  if (a === null || b === null) return false;
  const results: Partial<Record<LogicOp, boolean>> = {
    eq: a === b,
    neq: a !== b,
    lt: a < b,
    lte: a <= b,
    gt: a > b,
    gte: a >= b,
  };
  return results[rule.op] ?? false;
}

function matchDate(rule: LogicRule, value: AnswerValue): boolean {
  const a = dateKey(value);
  const b = dateKey(rule.value);
  if (a === null || b === null) return false;
  const results: Partial<Record<LogicOp, boolean>> = {
    is: a === b,
    is_not: a !== b,
    lt: a < b,
    lte: a <= b,
    gt: a > b,
    gte: a >= b,
  };
  return results[rule.op] ?? false;
}

function matchChoice(rule: LogicRule, value: AnswerValue): boolean {
  const picked = Array.isArray(value) ? value : [value];
  return picked.includes(rule.value as string) === (rule.op === "is");
}

const matchYesNo = (rule: LogicRule, value: AnswerValue): boolean => value === rule.value;

const trimmed = (_question: unknown, value: AnswerValue): AnswerValue =>
  typeof value === "string" ? value.trim() : value;
const asNumber = (_question: unknown, value: AnswerValue): AnswerValue => Number(value);

// Typeform's default texts for these two types (docs/design/typeform-free-features-audit.md, section 4).
const WEBSITE_ERROR = "Hmm… that web address doesn’t look right. Check for any typos or errors.";
const PHONE_ERROR = "Hmm... that phone number doesn't look right";
const WEBSITE_MAX = 2000;
// http(s) only, scheme optional ("example.com" is fine), a dotted host with a real top-level label, no spaces.
// The same rule as the server's.
const WEBSITE = /^(?:https?:\/\/)?(?:[^\s/?#:@.]+\.)+[^\s/?#:@.]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$/i;

/** Reads a phone number; a leading "+" carries its own country, anything else uses `defaultCountry`. */
function parsePhone(value: unknown, defaultCountry?: string) {
  if (typeof value !== "string") return undefined;
  return parsePhoneNumberFromString(value.trim(), defaultCountry as CountryCode | undefined);
}

type TextQuestion = PublicQuestionOf<"short_text"> | PublicQuestionOf<"long_text">;
type ChoiceQuestion = PublicQuestionOf<"multiple_choice"> | PublicQuestionOf<"dropdown">;

function validateText(question: TextQuestion, value: AnswerValue): string | null {
  const max = question.properties.max_length;
  if (typeof value !== "string") return "Please enter some text";
  return max && value.length > max ? `Please keep it under ${max} characters` : null;
}

function validateEmail(_question: PublicQuestionOf<"email">, value: AnswerValue): string | null {
  return typeof value === "string" && EMAIL.test(value.trim()) ? null : "Hmm… that email doesn't look right";
}

function validateNumber(question: PublicQuestionOf<"number">, value: AnswerValue): string | null {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return "Please enter a number";
  const { min, max } = question.properties;
  if (min !== undefined && n < min) return `Please enter a number of ${min} or more`;
  if (max !== undefined && n > max) return `Please enter a number of ${max} or less`;
  return null;
}

function validateRating(question: PublicQuestionOf<"rating">, value: AnswerValue): string | null {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= question.properties.max
    ? null
    : "Please choose a rating";
}

function validateYesNo(_question: PublicQuestionOf<"yes_no">, value: AnswerValue): string | null {
  return typeof value === "boolean" ? null : "Please choose Yes or No";
}

function validateMultipleChoice(question: PublicQuestionOf<"multiple_choice">, value: AnswerValue): string | null {
  const ids = new Set(question.properties.options.map((o) => o.id));
  const picked = Array.isArray(value) ? value : [value];
  if (!question.properties.allow_multiple && picked.length > 1) return "Please choose one option";
  return picked.every((id) => typeof id === "string" && ids.has(id)) ? null : "Please choose from the options";
}

function validateDropdown(question: PublicQuestionOf<"dropdown">, value: AnswerValue): string | null {
  return question.properties.options.some((o) => o.id === value) ? null : "Please choose from the list";
}

function validateWebsite(_question: PublicQuestionOf<"website">, value: AnswerValue): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= WEBSITE_MAX && WEBSITE.test(text) ? null : WEBSITE_ERROR;
}

function validatePhone(question: PublicQuestionOf<"phone_number">, value: AnswerValue): string | null {
  return parsePhone(value, question.properties.default_country)?.isValid() ? null : PHONE_ERROR;
}

function phoneToSubmission(question: PublicQuestionOf<"phone_number">, value: AnswerValue): AnswerValue {
  const phone = parsePhone(value, question.properties.default_country);
  return phone?.isValid() ? phone.number : String(value).trim();
}

const formatPhone = (_question: unknown, value: AnswerValue): string =>
  parsePhone(value)?.formatInternational() ?? String(value);

// Typeform's default texts for a required consent that wasn't given.
const LEGAL_REQUIRED = "Please agree to the terms & conditions";
const CHECKBOX_REQUIRED = "Oops! Please make a selection";
const RATING_ERROR = "Please choose a rating";

const isTrue = (value: AnswerValue): boolean => value === true;

const validateLegal = (_question: PublicQuestionOf<"legal">, value: AnswerValue): string | null =>
  typeof value === "boolean" ? null : "Please choose I accept or I don’t accept";

const validateCheckbox = (_question: PublicQuestionOf<"checkbox">, value: AnswerValue): string | null =>
  typeof value === "boolean" ? null : "Please tick the box or leave it empty";

const validateOpinionScale = (question: PublicQuestionOf<"opinion_scale">, value: AnswerValue): string | null =>
  isStepInRange(value, ...scaleRange(question.properties)) ? null : RATING_ERROR;

const validateNps = (_question: PublicQuestionOf<"nps">, value: AnswerValue): string | null =>
  isStepInRange(value, ...NPS_RANGE) ? null : RATING_ERROR;

const validateDateAnswer = (question: PublicQuestionOf<"date">, value: AnswerValue): string | null =>
  validateDate(question.properties, value);

const formatDateAnswer = (question: PublicQuestionOf<"date">, value: AnswerValue): string =>
  formatDate(value, question.properties);

const formatText = (_question: unknown, value: AnswerValue): string => String(value);
const formatYesNo = (_question: unknown, value: AnswerValue): string => (value ? "Yes" : "No");
const formatLegal = (_question: unknown, value: AnswerValue): string => (value ? "Accepted" : "Declined");
const formatCheckbox = (_question: unknown, value: AnswerValue): string => (value ? "Checked" : "Unchecked");
const formatRating = (question: PublicQuestionOf<"rating">, value: AnswerValue): string =>
  `${value}/${question.properties.max}`;
const formatNumberAnswer = (_question: unknown, value: AnswerValue): string =>
  typeof value === "number" ? formatNumber(value) : String(value);

/** Labels for the option ids in a choice answer; ids removed since the response show as such. */
function formatChoice(question: ChoiceQuestion, value: AnswerValue): string {
  const ids = Array.isArray(value) ? value : [String(value)];
  return ids
    .map((id) => {
      const option = question.properties.options.find((o) => o.id === id);
      if (!option) return "(removed choice)";
      return option.label || "(untitled choice)";
    })
    .join(", ");
}

// ---- the registry ---------------------------------------------------------

// Colors follow Typeform's groups: text = blue, choice (incl. yes/no) = lavender, rating = green,
// contact = pink, other = yellow. Icons and numbers on a chip are always the same dark ink.
export const QUESTION_TYPE_DEFS: { [T in QuestionType]: QuestionTypeDef<T> } = {
  short_text: {
    label: "Short Text",
    icon: Equal,
    chip: "bg-qt-text text-qt-fg",
    group: "text",
    answerable: true,
    ops: TEXT_OPS,
    validate: validateText,
    format: formatText,
    ruleMatches: matchText,
    toSubmission: trimmed,
  },
  long_text: {
    label: "Long Text",
    icon: AlignLeft,
    chip: "bg-qt-text text-qt-fg",
    group: "text",
    answerable: true,
    ops: TEXT_OPS,
    validate: validateText,
    format: formatText,
    ruleMatches: matchText,
    toSubmission: trimmed,
  },
  multiple_choice: {
    label: "Multiple Choice",
    icon: ListChecks,
    chip: "bg-qt-choice text-qt-fg",
    group: "choice",
    answerable: true,
    ops: CHOICE_OPS,
    validate: validateMultipleChoice,
    format: formatChoice,
    ruleMatches: matchChoice,
    toSubmission: trimmed,
  },
  dropdown: {
    label: "Dropdown",
    icon: ChevronDown,
    chip: "bg-qt-choice text-qt-fg",
    group: "choice",
    answerable: true,
    ops: CHOICE_OPS,
    validate: validateDropdown,
    format: formatChoice,
    ruleMatches: matchChoice,
    toSubmission: trimmed,
  },
  email: {
    label: "Email",
    icon: Mail,
    chip: "bg-qt-contact text-qt-fg",
    group: "contact",
    answerable: true,
    ops: TEXT_OPS,
    validate: validateEmail,
    format: formatText,
    ruleMatches: matchText,
    toSubmission: trimmed,
  },
  number: {
    label: "Number",
    icon: Hash,
    chip: "bg-qt-other text-qt-fg",
    group: "other",
    answerable: true,
    ops: NUMBER_OPS,
    validate: validateNumber,
    format: formatNumberAnswer,
    ruleMatches: matchNumber,
    toSubmission: asNumber,
  },
  yes_no: {
    label: "Yes/No",
    icon: CircleSlash,
    chip: "bg-qt-choice text-qt-fg",
    group: "choice",
    answerable: true,
    ops: ["is"],
    validate: validateYesNo,
    format: formatYesNo,
    ruleMatches: matchYesNo,
    toSubmission: trimmed,
  },
  rating: {
    label: "Rating",
    icon: Star,
    chip: "bg-qt-rating text-qt-fg",
    group: "rating",
    answerable: true,
    ops: NUMBER_OPS,
    validate: validateRating,
    format: formatRating,
    ruleMatches: matchNumber,
    toSubmission: trimmed,
  },
  website: {
    label: "Website",
    icon: Globe,
    chip: "bg-qt-contact text-qt-fg",
    group: "contact",
    answerable: true,
    ops: TEXT_OPS,
    validate: validateWebsite,
    format: formatText,
    ruleMatches: matchText,
    toSubmission: trimmed,
  },
  phone_number: {
    label: "Phone Number",
    icon: Phone,
    chip: "bg-qt-contact text-qt-fg",
    group: "contact",
    answerable: true,
    ops: TEXT_OPS,
    validate: validatePhone,
    format: formatPhone,
    ruleMatches: matchText,
    toSubmission: phoneToSubmission,
  },
  date: {
    label: "Date",
    icon: Calendar,
    chip: "bg-qt-other text-qt-fg",
    group: "other",
    answerable: true,
    ops: DATE_OPS,
    opLabels: { lt: "is before", lte: "is on or before", gt: "is after", gte: "is on or after" },
    validate: validateDateAnswer,
    format: formatDateAnswer,
    ruleMatches: matchDate,
    toSubmission: trimmed,
  },
  legal: {
    label: "Legal",
    icon: Scale,
    chip: "bg-qt-choice text-qt-fg",
    group: "choice",
    answerable: true,
    requiredMessage: LEGAL_REQUIRED,
    satisfiesRequired: isTrue,
    ops: ["is"],
    validate: validateLegal,
    format: formatLegal,
    ruleMatches: matchYesNo,
    toSubmission: trimmed,
  },
  checkbox: {
    label: "Checkbox",
    icon: SquareCheck,
    chip: "bg-qt-choice text-qt-fg",
    group: "choice",
    answerable: true,
    requiredMessage: CHECKBOX_REQUIRED,
    satisfiesRequired: isTrue,
    ops: ["is"],
    validate: validateCheckbox,
    format: formatCheckbox,
    ruleMatches: matchYesNo,
    toSubmission: trimmed,
  },
  opinion_scale: {
    label: "Opinion Scale",
    icon: SlidersHorizontal,
    chip: "bg-qt-rating text-qt-fg",
    group: "rating",
    answerable: true,
    ops: NUMBER_OPS,
    validate: validateOpinionScale,
    format: formatText,
    ruleMatches: matchNumber,
    toSubmission: trimmed,
  },
  nps: {
    label: "Net Promoter Score®",
    icon: Gauge,
    chip: "bg-qt-rating text-qt-fg",
    group: "rating",
    answerable: true,
    ops: NUMBER_OPS,
    validate: validateNps,
    format: formatText,
    ruleMatches: matchNumber,
    toSubmission: trimmed,
  },
};

/** The definition for a type, for callers that only have the wide `QuestionType`. */
export function getDef(type: QuestionType): QuestionTypeDef {
  return QUESTION_TYPE_DEFS[type] as unknown as QuestionTypeDef;
}

// ---- names older callers use ---------------------------------------------

export type QuestionTypeMeta = Pick<QuestionTypeDef, "label" | "icon" | "chip">;
export const QUESTION_TYPE_META = QUESTION_TYPE_DEFS;
export const QUESTION_TYPE_LIST = QUESTION_TYPES.map((type) => ({ type, ...QUESTION_TYPE_DEFS[type] }));

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

// Mirrors backend Pydantic schemas (backend/app/schemas, docs/API_SPEC.md). Keep in sync.

export type HealthResponse = { status: "ok" };

/** ISO-8601 UTC timestamp, e.g. "2026-10-08T14:43:30.508466Z". */
export type ISODateTime = string;

// ---- Enums -------------------------------------------------------------

export type FormStatus = "draft" | "published";

export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "multiple_choice",
  "dropdown",
  "email",
  "number",
  "yes_no",
  "rating",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// ---- Question properties (schemas/properties.py) ------------------------

export type ChoiceOption = { id: string; label: string };

export type TextProperties = { placeholder?: string; max_length?: number };
export type MultipleChoiceProperties = {
  options: ChoiceOption[];
  allow_multiple: boolean;
  allow_other: boolean;
};
export type DropdownProperties = { options: ChoiceOption[] };
export type NumberProperties = { min?: number; max?: number };
export type RatingShape = "star" | "heart" | "number";
export type RatingProperties = { max: number; shape: RatingShape };
export type EmptyProperties = Record<string, never>;

export type QuestionPropertiesMap = {
  short_text: TextProperties;
  long_text: TextProperties;
  multiple_choice: MultipleChoiceProperties;
  dropdown: DropdownProperties;
  email: EmptyProperties;
  number: NumberProperties;
  yes_no: EmptyProperties;
  rating: RatingProperties;
};

export const RATING_MAX_RANGE = { min: 3, max: 10 } as const;

// ---- Questions ---------------------------------------------------------

type QuestionBase = {
  id: number;
  form_id: number;
  title: string;
  description: string | null;
  required: boolean;
  /** 0-based, contiguous within a form. */
  position: number;
};

/** Discriminated on `type`, so `properties` narrows automatically. */
export type Question = {
  [T in QuestionType]: QuestionBase & { type: T; properties: QuestionPropertiesMap[T] };
}[QuestionType];

export type QuestionOf<T extends QuestionType> = Extract<Question, { type: T }>;

export type QuestionCreate = {
  type: QuestionType;
  title?: string;
  description?: string | null;
  required?: boolean;
  /** Omit to get the server's per-type defaults. */
  properties?: QuestionPropertiesMap[QuestionType];
  /** Omit to append; values past the end are clamped. */
  position?: number;
};

/** Partial update; `properties` replaces the whole object. `type` is immutable. */
export type QuestionUpdate = {
  title?: string;
  description?: string | null;
  required?: boolean;
  properties?: QuestionPropertiesMap[QuestionType];
};

export type QuestionOrder = { ordered_ids: number[] };

// ---- Forms -------------------------------------------------------------

export type Theme = {
  background: string;
  text_color: string;
  button_color: string;
  font: string;
};

export type ThankYou = {
  title: string;
  message: string;
  button_text: string | null;
  button_url: string | null;
};

type FormBase = {
  id: number;
  slug: string;
  title: string;
  status: FormStatus;
  /** Completed responses only. */
  response_count: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  published_at: ISODateTime | null;
};

export type FormListItem = FormBase & { question_count: number };

export type Form = FormBase & {
  description: string | null;
  theme: Theme;
  thank_you: ThankYou;
  /** Ordered by position. */
  questions: Question[];
};

export type FormCreate = { title?: string };

export type FormUpdate = {
  title?: string;
  description?: string | null;
  theme?: Theme;
  thank_you?: ThankYou;
};

// ---- Errors ------------------------------------------------------------

/** `{ detail: string }` or, for 422, `{ detail: { errors: { "<field or question id>": msg } } }`. */
export type ApiErrorBody = { detail: string | { errors: Record<string, string> } };

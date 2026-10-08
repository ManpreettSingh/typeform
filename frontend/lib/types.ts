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

// ---- Branching (schemas/logic.py) ---------------------------------------

export type LogicOp = "is" | "is_not" | "contains" | "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
/** Option id (choice/dropdown), boolean (yes/no), number (number/rating) or text. */
export type LogicValue = string | number | boolean;
/** A question id of the same form, or "end" to finish the form. */
export type LogicTarget = number | "end";
export type LogicRule = { op: LogicOp; value: LogicValue; to: LogicTarget };
/** Checked in order once the question is answered; first match wins, otherwise the next question. */
export type Logic = { rules: LogicRule[] };

// ---- Questions ---------------------------------------------------------

type QuestionFields = {
  id: number;
  title: string;
  description: string | null;
  required: boolean;
  /** Branching rules; null when the question always goes to the next one. */
  logic: Logic | null;
};

/** A question as respondents see it (public API). Discriminated on `type`, so `properties` narrows. */
export type PublicQuestion = {
  [T in QuestionType]: QuestionFields & { type: T; properties: QuestionPropertiesMap[T] };
}[QuestionType];

export type PublicQuestionOf<T extends QuestionType> = Extract<PublicQuestion, { type: T }>;

/** A question as the creator API returns it. */
export type Question = PublicQuestion & {
  form_id: number;
  /** 0-based, contiguous within a form. */
  position: number;
};

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
  /** Replaces all rules; null (or no rules) removes them. */
  logic?: Logic | null;
};

export type QuestionOrder = { ordered_ids: number[] };

// ---- Answers (DATABASE_SCHEMA.md "value formats") ----------------------

export type AnswerValueMap = {
  short_text: string;
  long_text: string;
  email: string;
  /** number while typing may be an unparsable string; validation rejects it. */
  number: number | string;
  rating: number;
  yes_no: boolean;
  /** option id, or option ids when allow_multiple */
  multiple_choice: string | string[];
  /** option id */
  dropdown: string;
};
export type AnswerValue = AnswerValueMap[QuestionType];
/** Answers keyed by question id. */
export type Answers = Record<number, AnswerValue | undefined>;

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

export type FormListItem = FormBase & {
  question_count: number;
  /** The form's own colors: its workspace icon and card are drawn with them (not with the app theme). */
  theme: Theme;
  /** Every response, partial included; completion rate = response_count / response_total. */
  response_total: number;
};

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

// ---- Public (respondent) ----------------------------------------------

/** `GET /public/forms/{slug}`: published forms only, no internal fields. */
export type PublicForm = {
  slug: string;
  title: string;
  /** Shown as the welcome-screen subtitle; no description → no welcome screen. */
  description: string | null;
  theme: Theme;
  thank_you: ThankYou;
  /** Ordered by position. */
  questions: PublicQuestion[];
};

/** Keys are question ids. Empty optional answers are omitted. */
export type SubmissionIn = { answers: Record<string, AnswerValue> };
export type SubmissionOut = { id: number };

/** Bonus partial responses: `POST …/responses/start`, then `PATCH /public/responses/{id}`. */
export type PartialStartOut = { response_id: number; token: string };
/** `answers` replaces what's stored; `complete` = final submission (full validation). */
export type PartialUpdateIn = SubmissionIn & { token: string; complete?: boolean };
export type PartialUpdateOut = { id: number; status: ResponseStatus };

// ---- Results (creator) ------------------------------------------------

export type ResponseStatus = "partial" | "completed";

type ResponseBase = {
  id: number;
  status: ResponseStatus;
  started_at: ISODateTime;
  /** null while partial. */
  submitted_at: ISODateTime | null;
};

/** Answers keyed by question id; unanswered questions are absent. */
export type ResponseListItem = ResponseBase & { answers: Record<string, AnswerValue> };

export type ResponsePage = { items: ResponseListItem[]; total: number; page: number; page_size: number };

export type ResponseAnswer = {
  question_id: number;
  question_title: string;
  question_type: QuestionType;
  value: AnswerValue;
};

/** Answers in question order; unanswered questions are absent. */
export type ResponseDetail = ResponseBase & { answers: ResponseAnswer[] };

export type OptionCount = { option_id: string; label: string; count: number };

type QuestionSummaryBase = {
  question_id: number;
  title: string;
  /** Completed responses that answered this question. */
  answered: number;
};

export type ChoiceSummary = QuestionSummaryBase & {
  type: "multiple_choice" | "dropdown" | "yes_no";
  /** In option order. Multi-select counts can sum to more than `answered`. */
  counts: OptionCount[];
};
export type RatingSummary = QuestionSummaryBase & {
  type: "rating";
  max: number;
  average: number | null;
  /** "1".."max" → count. */
  distribution: Record<string, number>;
};
export type NumberSummary = QuestionSummaryBase & {
  type: "number";
  min: number | null;
  max: number | null;
  average: number | null;
};
export type TextSummary = QuestionSummaryBase & {
  type: "short_text" | "long_text" | "email";
  /** Most recent first, at most 5. */
  recent: string[];
};
export type QuestionSummary = ChoiceSummary | RatingSummary | NumberSummary | TextSummary;

export type FormSummary = {
  /** Every response, partial included. */
  total_responses: number;
  completed: number;
  /** completed / total_responses (0–1); 0 when there are no responses. */
  completion_rate: number;
  /** In question order; stats cover completed responses only. */
  questions: QuestionSummary[];
};

// ---- Errors ------------------------------------------------------------

/** `{ detail: string }` or, for 422, `{ detail: { errors: { "<field or question id>": msg } } }`. */
export type ApiErrorBody = { detail: string | { errors: Record<string, string> } };

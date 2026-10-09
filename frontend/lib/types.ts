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
  "picture_choice",
  "dropdown",
  "email",
  "number",
  "yes_no",
  "rating",
  "website",
  "phone_number",
  "date",
  "legal",
  "checkbox",
  "opinion_scale",
  "nps",
  "statement",
  "contact_info",
  "address",
  "ranking",
  "matrix",
  "group",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// ---- Question properties (schemas/properties.py) ------------------------

export type MediaAttachment = {
  type: "image";
  public_id: string;
  url: string;
  alt: string;
  focal_point?: Record<string, unknown> | null;
  brightness?: number | null;
  scale?: number | null;
};

export type MediaLayout = {
  type: "stack" | "split" | "float" | "wallpaper";
  placement: "left" | "right" | null;
};

export type MediaProperties = {
  attachment?: MediaAttachment | null;
  layout?: MediaLayout | null;
  viewport_overrides?: Record<string, unknown> | null;
};

type WithMedia<T> = T & MediaProperties;

export type ChoiceOption = WithMedia<{ id: string; label: string }>;

export type TextProperties = { placeholder?: string; max_length?: number };
export type MultipleChoiceProperties = {
  options: ChoiceOption[];
  allow_multiple: boolean;
  allow_other: boolean;
  none_of_the_above: boolean;
  randomize: boolean;
  min_selections?: number;
  max_selections?: number;
};
export type PictureChoiceProperties = MultipleChoiceProperties & {
  show_labels: boolean;
  supersized: boolean;
};
export type DropdownProperties = { 
  options: ChoiceOption[];
  alphabetical: boolean;
  randomize: boolean;
};
export type NumberProperties = { min?: number; max?: number };
export type RatingShape = 
  | "star" | "heart" | "crown" | "cat" | "dog" | "droplet" | "flag" 
  | "lightbulb" | "pencil" | "skull" | "thunderbolt" | "tick" 
  | "trophy" | "up" | "user" | "circle" | "cloud" | "number";
export type RatingProperties = { max: number; shape: RatingShape };
export type EmptyProperties = Record<string, never>;
export type WebsiteProperties = EmptyProperties;
/** `default_country` is an ISO 3166 alpha-2 code used to read numbers typed without a "+" country code. */
export type PhoneProperties = { default_country: string };
export type DateFormat = "MMDDYYYY" | "DDMMYYYY" | "YYYYMMDD";
export type DateSeparator = "/" | "-" | ".";
/** Limits are ISO dates (YYYY-MM-DD); absent when not set. */
export type DateProperties = { format: DateFormat; separator: DateSeparator; start_date?: string; end_date?: string };

/** Captions under the left end, middle and right end of a scale; any may be empty. */
export type ScaleLabels = { left: string; center: string; right: string };
/** A scale of `steps` boxes starting at 1 (or at 0 when `start_at_one` is off). */
export type OpinionScaleProperties = { steps: number; start_at_one: boolean; labels: ScaleLabels };
export type NpsProperties = { labels: ScaleLabels };
/** The text beside the box; the question title stays above it. */
export type CheckboxProperties = { label: string };
export type StatementProperties = { button_text: string; hide_marks: boolean };
export type CompositeField = { key: string; label: string; enabled: boolean; required: boolean };
export type ContactInfoProperties = { fields: CompositeField[] };
export type AddressProperties = { fields: CompositeField[] };

export type RankingProperties = { options: ChoiceOption[]; randomize: boolean };
export type MatrixProperties = { rows: ChoiceOption[]; columns: ChoiceOption[]; multiple_selection: boolean };
export type GroupProperties = { button_text: string };

export type QuestionPropertiesMap = {
  short_text: WithMedia<TextProperties>;
  long_text: WithMedia<TextProperties>;
  multiple_choice: WithMedia<MultipleChoiceProperties>;
  picture_choice: WithMedia<PictureChoiceProperties>;
  dropdown: WithMedia<DropdownProperties>;
  email: WithMedia<EmptyProperties>;
  number: WithMedia<NumberProperties>;
  yes_no: WithMedia<EmptyProperties>;
  rating: WithMedia<RatingProperties>;
  website: WithMedia<WebsiteProperties>;
  phone_number: WithMedia<PhoneProperties>;
  date: WithMedia<DateProperties>;
  legal: WithMedia<EmptyProperties>;
  checkbox: WithMedia<CheckboxProperties>;
  opinion_scale: WithMedia<OpinionScaleProperties>;
  nps: WithMedia<NpsProperties>;
  statement: WithMedia<StatementProperties>;
  contact_info: WithMedia<ContactInfoProperties>;
  address: WithMedia<AddressProperties>;
  ranking: WithMedia<RankingProperties>;
  matrix: WithMedia<MatrixProperties>;
  group: WithMedia<GroupProperties>;
};

export const RATING_MAX_RANGE = { min: 3, max: 10 } as const;
export const OPINION_SCALE_STEPS = { min: 5, max: 11 } as const;
export const SCALE_LABEL_MAX = 80;

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

export type Ending = MediaProperties & {
  id: number;
  form_id: number;
  position: number;
  title: string;
  message: string;
  button_text: string | null;
  button_url: string | null;
};

export type Welcome = MediaProperties & {
  button_text: string;
  show_time_to_complete: boolean;
  show_submission_count: boolean;
};

type QuestionFields = {
  id: number;
  title: string;
  description: string | null;
  required: boolean;
  group_title?: string | null;
  group_id?: number | null;
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
  group_id: number | null;
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
  type?: QuestionType;
  title?: string;
  description?: string | null;
  required?: boolean;
  properties?: QuestionPropertiesMap[QuestionType];
  /** Replaces all rules; null (or no rules) removes them. */
  logic?: Logic | null;
  group_id?: number | null;
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
  picture_choice: string | string[];
  /** option id */
  dropdown: string;
  website: string;
  /** E.164, e.g. "+12015550123" */
  phone_number: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** true = accepted */
  legal: boolean;
  /** true = ticked; an untouched box has no answer */
  checkbox: boolean;
  opinion_scale: number;
  /** 0..10 */
  nps: number;
  statement: never;
  contact_info: Record<string, string>;
  address: Record<string, string>;
  ranking: string[];
  matrix: Record<string, string | string[]>;
  group: never;
};
export type AnswerValue = AnswerValueMap[QuestionType];
/** Answers keyed by question id. */
export type Answers = Record<number, AnswerValue | undefined>;

// ---- Forms -------------------------------------------------------------

export type Theme = {
  question: string;
  answer: string;
  button: string;
  background: string;
  font: string;
  background_image: string | null;
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
  welcome: Welcome;
  /** Ordered by position. */
  questions: Question[];
  endings: Ending[];
};

export type FormCreate = { title?: string; workspace_id?: number };

/** Typeform AI: a request in plain words ("Create with AI", "Chat to create", "Ask Typeform AI"). */
export type AiPrompt = { prompt: string };

export type FormUpdate = {
  title?: string;
  description?: string | null;
  theme?: Theme;
  thank_you?: ThankYou;
  welcome?: Welcome;
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
  welcome: Welcome;
  submission_count: number | null;
  /** Ordered by position. */
  questions: PublicQuestion[];
  endings: Ending[];
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
  type: "multiple_choice" | "dropdown" | "yes_no" | "legal" | "checkbox";
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
export type ScaleSummary = QuestionSummaryBase & {
  type: "opinion_scale";
  /** First and last step of the scale as it is configured now. */
  min: number;
  max: number;
  average: number | null;
  /** "min".."max" → count. */
  distribution: Record<string, number>;
};
export type NpsGroup = { count: number; /** 0–100, one decimal */ percent: number };
export type NpsSummary = QuestionSummaryBase & {
  type: "nps";
  average: number | null;
  /** "0".."10" → count. */
  distribution: Record<string, number>;
  promoters: NpsGroup;
  passives: NpsGroup;
  detractors: NpsGroup;
  /** % promoters − % detractors as a whole number (−100…100); null without answers. */
  score: number | null;
};
export type NumberSummary = QuestionSummaryBase & {
  type: "number";
  min: number | null;
  max: number | null;
  average: number | null;
};
export type TextAnswer = { value: string; submitted_at: ISODateTime };
export type TextSummary = QuestionSummaryBase & {
  type: "short_text" | "long_text" | "email" | "website" | "phone_number" | "date";
  /** Every answer, most recent first. */
  answers: TextAnswer[];
};
export type CompositeSummary = QuestionSummaryBase & {
  type: "contact_info" | "address";
  answers: TextAnswer[];
};
export type RankAverage = {
  option_id: string;
  label: string;
  average: number;
};
export type RankingSummary = QuestionSummaryBase & {
  type: "ranking";
  ranks: Record<string, RankAverage>;
};
export type MatrixSummary = QuestionSummaryBase & {
  type: "matrix";
  rows: Record<string, ChoiceSummary>;
};
export type QuestionSummary = ChoiceSummary | RatingSummary | ScaleSummary | NpsSummary | NumberSummary | TextSummary | CompositeSummary | RankingSummary | MatrixSummary;

export type FormSummary = {
  /** Every response, partial included. */
  total_responses: number;
  completed: number;
  /** completed / total_responses (0–1); 0 when there are no responses. */
  completion_rate: number;
  /** Form performance: times the public form was opened. Starts = total_responses, submissions = completed. */
  views: number;
  /** Average fill time of timed completed responses, in seconds; null when there are none. */
  average_seconds: number | null;
  /** In question order; stats cover completed responses only. */
  questions: QuestionSummary[];
};

// ---- Errors ------------------------------------------------------------

/** `{ detail: string }` or, for 422, `{ detail: { errors: { "<field or question id>": msg } } }`. */
export type ApiErrorBody = { detail: string | { errors: Record<string, string> } };

// Mirrors backend/app/services/ai_schemas.py (the Typeform AI chat). Keep in sync.
import type { QuestionType } from "@/lib/types";

export const AI_MEMORY_MAX = 2000;

export type AiRole = "user" | "assistant";
export type AiMessage = { role: AiRole; content: string };

export type ProposalWelcome = {
  title: string;
  description: string | null;
  button_text: string;
  show_time_to_complete: boolean;
  show_submission_count: boolean;
};

export type ProposalQuestion = {
  /** null = a question the AI wants to add. */
  id: number | null;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  properties: Record<string, unknown>;
  group_id: number | null;
};

export type ProposalEnding = {
  id: number | null;
  title: string;
  message: string;
  button_text: string | null;
  button_url: string | null;
};

/** The whole form as it would look after the change; Apply saves exactly this. */
export type Proposal = {
  welcome: ProposalWelcome;
  questions: ProposalQuestion[];
  endings: ProposalEnding[];
};

export type QuestionSummary = { id: number | null; type: QuestionType; title: string; position: number };
export type ChangeKind = "new" | "changed" | "moved";
export type QuestionChange = QuestionSummary & { change: ChangeKind; fields: string[]; moved: boolean };
export type EndingSummary = { id: number | null; title: string; position: number };
export type EndingChange = EndingSummary & { change: ChangeKind; fields: string[]; moved: boolean };

/** What Apply would do, compared with the saved form. */
export type Diff = {
  to_remove: QuestionSummary[];
  to_set: QuestionChange[];
  endings: { to_remove: EndingSummary[]; to_set: EndingChange[] };
  /** Names of the welcome fields that differ. */
  welcome: string[];
};

export type ChatIn = {
  /** null = the AI drafts a brand-new form (Apply creates it). */
  form_id: number | null;
  messages: AiMessage[];
  /** The proposal the creator is reviewing, so the next turn builds on it. */
  draft?: Proposal | null;
  /** An unsaved memory edit for this call. */
  memory?: string | null;
};
export type ChatOut = { reply: string; proposal: Proposal | null; diff: Diff | null };
export type ApplyIn = { form_id: number | null; proposal: Proposal };
export type AiMemory = { content: string; max_length: number };

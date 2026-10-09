// Turns a proposal into what the respondent components render, and describes changes for the review list.
import type { Ending, PublicQuestion, ThankYou } from "@/lib/types";
import type { Proposal, QuestionChange } from "./types";

export type PreviewWelcome = {
  title: string;
  description: string;
  button_text: string;
  show_time_to_complete: boolean;
  show_submission_count: boolean;
  submission_count: number | null;
};

export type Preview = {
  questions: PublicQuestion[];
  endings: Ending[];
  thankYou: ThankYou;
  welcome: PreviewWelcome | null;
};

/** New items have no id yet: they get unique negative ones so React keys and the flow's answers stay distinct. */
export function proposalToPreview(p: Proposal): Preview {
  let nextQuestionId = 0;
  const groupTitle = new Map(p.questions.filter((q) => q.type === "group" && q.id !== null).map((q) => [q.id as number, q.title]));
  const questions = p.questions.map((q) => {
    const id = q.id ?? --nextQuestionId;
    return {
      id,
      type: q.type,
      title: q.title,
      description: q.description,
      required: q.required,
      properties: q.properties,
      logic: null,
      group_id: q.group_id,
      group_title: q.group_id !== null ? (groupTitle.get(q.group_id) ?? null) : null,
    } as unknown as PublicQuestion;
  });

  let nextEndingId = 0;
  const endings: Ending[] = p.endings.map((e, position) => ({
    id: e.id ?? --nextEndingId,
    form_id: 0,
    position,
    title: e.title,
    message: e.message,
    button_text: e.button_text,
    button_url: e.button_url,
  }));
  const first = p.endings[0];
  const thankYou: ThankYou = first
    ? { title: first.title, message: first.message, button_text: first.button_text, button_url: first.button_url }
    : { title: "Thanks for completing this form", message: "Your response has been recorded.", button_text: null, button_url: null };

  const description = p.welcome.description?.trim();
  const welcome = description
    ? {
        title: p.welcome.title,
        description,
        button_text: p.welcome.button_text,
        show_time_to_complete: p.welcome.show_time_to_complete,
        show_submission_count: p.welcome.show_submission_count,
        submission_count: null,
      }
    : null;
  return { questions, endings, thankYou, welcome };
}

const words = (field: string) => field.replace(/_/g, " ");

/** The small caption under a question in "Suggested changes". */
export function changeLabel(c: Pick<QuestionChange, "change" | "fields" | "moved">): string {
  if (c.change === "new") return "New";
  if (c.change === "moved") return "Moved";
  return `Edited: ${c.fields.map(words).join(", ")}${c.moved ? " · moved" : ""}`;
}

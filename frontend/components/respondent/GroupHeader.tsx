import type { AnswerProps } from "@/components/respondent/types";

export function GroupHeader({ question, onSubmit }: AnswerProps<"group">) {
  // Normally the header is rendered by RespondentFlow itself above the children,
  // but if it's treated as a standalone screen, we provide a continue button.
  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onSubmit}
        className="self-start rounded bg-accent px-6 py-3 font-semibold text-white hover:bg-accent/90"
      >
        {question.properties.button_text || "Continue"}
      </button>
    </div>
  );
}

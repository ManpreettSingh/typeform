import type { AnswerProps } from "@/components/respondent/types";

/**
 * Respondents never see a Partial Submit Point (`toRespondentQuestions` removes it), so this only shows on the builder
 * canvas, where it explains what the point does.
 */
export function PartialSubmitNote(_props: AnswerProps<"partial_submit">) {
  return (
    <p className="max-w-xl text-base opacity-70">
      When a respondent gets here, their answers so far count as a submission, even if they never finish the form.
    </p>
  );
}

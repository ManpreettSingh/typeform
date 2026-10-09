// The respondent-side half of the question-type registry: which component takes the answer for each type.
// Kept apart from the builder's settings map so the public form never bundles builder code.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { MultipleChoiceAnswer, YesNoAnswer, PictureChoiceAnswer } from "@/components/respondent/answers/ChoiceAnswer";
import { CheckboxAnswer } from "@/components/respondent/answers/CheckboxAnswer";
import { DateAnswer } from "@/components/respondent/answers/DateAnswer";
import { DropdownAnswer } from "@/components/respondent/answers/DropdownAnswer";
import { FileUploadAnswer } from "@/components/respondent/answers/FileUploadAnswer";
import { PaymentAnswer } from "@/components/respondent/answers/PaymentAnswer";
import { LegalAnswer } from "@/components/respondent/answers/LegalAnswer";
import { NpsAnswer } from "@/components/respondent/answers/NpsAnswer";
import { OpinionScaleAnswer } from "@/components/respondent/answers/OpinionScaleAnswer";
import { RatingAnswer } from "@/components/respondent/answers/RatingAnswer";
import { EmailAnswer, LongTextAnswer, NumberAnswer, ShortTextAnswer } from "@/components/respondent/answers/TextAnswer";
import { WebsiteAnswer } from "@/components/respondent/answers/WebsiteAnswer";
import { CompositeAnswer } from "@/components/respondent/answers/CompositeAnswer";
import { RankingAnswer } from "@/components/respondent/answers/RankingAnswer";
import { MatrixAnswer } from "@/components/respondent/answers/MatrixAnswer";
import { StatementScreen } from "@/components/respondent/StatementScreen";
import { PartialSubmitNote } from "@/components/respondent/PartialSubmitNote";
import { GroupHeader } from "@/components/respondent/GroupHeader";
import type { AnswerProps } from "@/components/respondent/types";
import type { QuestionType } from "@/lib/types";

// The phone input carries every country flag, so it loads only on forms that have a phone question.
const PhoneAnswer = dynamic(() => import("@/components/respondent/answers/PhoneAnswer").then((m) => m.PhoneAnswer));

/** A type missing here is a compile error, so a new type can't ship without its answer component. */
export const ANSWER_COMPONENTS = {
  short_text: ShortTextAnswer,
  long_text: LongTextAnswer,
  email: EmailAnswer,
  number: NumberAnswer,
  multiple_choice: MultipleChoiceAnswer,
  picture_choice: PictureChoiceAnswer,
  dropdown: DropdownAnswer,
  yes_no: YesNoAnswer,
  rating: RatingAnswer,
  website: WebsiteAnswer,
  phone_number: PhoneAnswer,
  date: DateAnswer,
  legal: LegalAnswer,
  checkbox: CheckboxAnswer,
  opinion_scale: OpinionScaleAnswer,
  nps: NpsAnswer,
  statement: StatementScreen,
  contact_info: CompositeAnswer as ComponentType<AnswerProps<"contact_info">>,
  address: CompositeAnswer as ComponentType<AnswerProps<"address">>,
  ranking: RankingAnswer,
  matrix: MatrixAnswer,
  group: GroupHeader,
  file_upload: FileUploadAnswer,
  payment: PaymentAnswer,
  partial_submit: PartialSubmitNote,
} satisfies { [T in QuestionType]: ComponentType<AnswerProps<T>> };

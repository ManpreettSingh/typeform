// The builder-side half of the question-type registry: the type-specific rows of the Answer card in the right panel.
import type { ComponentType } from "react";
import { ChoiceSettings } from "@/components/builder/settings/ChoiceSettings";
import { PictureChoiceSettings } from "@/components/builder/settings/PictureChoiceSettings";
import { DateSettings } from "@/components/builder/settings/DateSettings";
import { NpsSettings } from "@/components/builder/settings/NpsSettings";
import { NumberSettings } from "@/components/builder/settings/NumberSettings";
import { OpinionScaleSettings } from "@/components/builder/settings/OpinionScaleSettings";
import { PhoneSettings } from "@/components/builder/settings/PhoneSettings";
import { RatingSettings } from "@/components/builder/settings/RatingSettings";
import { TextSettings } from "@/components/builder/settings/TextSettings";
import { StatementSettings } from "@/components/builder/settings/StatementSettings";
import { FieldListSettings } from "@/components/builder/settings/FieldListSettings";
import { RankingSettings } from "@/components/builder/settings/RankingSettings";
import { MatrixSettings } from "@/components/builder/settings/MatrixSettings";
import { GroupSettings } from "@/components/builder/settings/GroupSettings";
import { PaymentSettings } from "@/components/builder/settings/PaymentSettings";
import type { QuestionOf, QuestionType } from "@/lib/types";

/** `null` means the type has no settings beyond Required. A type missing here is a compile error. */
export const SETTINGS_COMPONENTS = {
  short_text: TextSettings,
  long_text: TextSettings,
  email: null,
  number: NumberSettings,
  multiple_choice: ChoiceSettings,
  picture_choice: PictureChoiceSettings,
  dropdown: ChoiceSettings,
  yes_no: null,
  rating: RatingSettings,
  website: null,
  phone_number: PhoneSettings,
  date: DateSettings,
  legal: null,
  checkbox: null,
  opinion_scale: OpinionScaleSettings,
  nps: NpsSettings,
  statement: StatementSettings,
  contact_info: FieldListSettings as unknown as ComponentType<{ question: QuestionOf<"contact_info"> }>,
  address: FieldListSettings as unknown as ComponentType<{ question: QuestionOf<"address"> }>,
  ranking: RankingSettings,
  matrix: MatrixSettings,
  group: GroupSettings,
  file_upload: null,
  payment: PaymentSettings,
  partial_submit: null,
} satisfies { [T in QuestionType]: ComponentType<{ question: QuestionOf<T> }> | null };

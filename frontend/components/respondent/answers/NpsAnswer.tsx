"use client";

import { NPS_RANGE } from "@/lib/questionTypes/scales";
import type { AnswerProps } from "../types";
import { ScaleInput } from "./ScaleInput";

/** Net Promoter Score: 0 to 10, captioned "Not at all likely" … "Extremely likely" unless the creator changed them. */
export function NpsAnswer({ question, ...input }: AnswerProps<"nps">) {
  return <ScaleInput range={NPS_RANGE} labels={question.properties.labels} {...input} />;
}

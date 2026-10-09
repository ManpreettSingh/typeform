"use client";

import { scaleRange } from "@/lib/questionTypes/scales";
import type { AnswerProps } from "../types";
import { ScaleInput } from "./ScaleInput";

/** Typeform's Opinion Scale: 5 to 11 boxes starting at 1 or 0, with optional captions. */
export function OpinionScaleAnswer({ question, ...input }: AnswerProps<"opinion_scale">) {
  return <ScaleInput range={scaleRange(question.properties)} labels={question.properties.labels} {...input} />;
}

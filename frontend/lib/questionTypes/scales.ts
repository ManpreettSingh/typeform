// Opinion scale and NPS: the range of steps a respondent can pick. Pure logic, shared by validation and the inputs.
import type { OpinionScaleProperties } from "@/lib/types";

/** NPS always asks for 0 to 10; promoters score 9–10, passives 7–8, detractors 0–6. */
export const NPS_RANGE: readonly [number, number] = [0, 10];

/** First and last step of an opinion scale: it starts at 1 (or 0) and has `steps` steps. */
export function scaleRange({ steps, start_at_one }: Pick<OpinionScaleProperties, "steps" | "start_at_one">): [number, number] {
  const low = start_at_one ? 1 : 0;
  return [low, low + steps - 1];
}

/** A whole number from `low` to `high`. Text and booleans are not numbers here, like the server. */
export function isStepInRange(value: unknown, low: number, high: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= low && value <= high;
}

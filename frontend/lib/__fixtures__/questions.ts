// Test helpers: build questions the way the public API returns them.
import type { PublicQuestion } from "@/lib/types";

let nextId = 0;

/** A question for tests. `properties` must fit `type`; pass `extra` to override id, required, logic, title… */
export function question(
  type: PublicQuestion["type"],
  properties: object = {},
  extra: Record<string, unknown> = {},
): PublicQuestion {
  nextId += 1;
  return {
    id: nextId,
    type,
    title: `Question ${nextId}`,
    description: null,
    required: false,
    logic: null,
    properties,
    ...extra,
  } as PublicQuestion;
}

/** Choice options with ids a, b, c… */
export function options(...labels: string[]) {
  return labels.map((label, i) => ({ id: String.fromCharCode(97 + i), label }));
}

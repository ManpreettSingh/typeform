// The typewriter placeholder of Typeform's AI prompt box (measured on admin.typeform.com): about one character per 50 ms
// while typing, a ~2 s hold, 1-3 characters per 50 ms while deleting, ~450 ms empty, then the next phrase.

export const TYPEWRITER_PHRASES = ["Explain the goal of your form.", "Type or paste your form questions."];

export type TypewriterPhase = "typing" | "holding" | "deleting" | "waiting";
export type TypewriterState = { phrase: number; shown: number; phase: TypewriterPhase };
export const typewriterStart: TypewriterState = { phrase: 0, shown: 0, phase: "typing" };

const TYPE_MS = 50;
const HOLD_MS = 2000;
const WAIT_MS = 450;

/** The next state and how long to show it. Deterministic, so it is easy to test. */
export function nextTypewriterStep(state: TypewriterState, phrases: string[]): { state: TypewriterState; delay: number } {
  const length = phrases[state.phrase]?.length ?? 0;
  switch (state.phase) {
    case "typing": {
      const shown = Math.min(state.shown + 1, length);
      return shown >= length
        ? { state: { ...state, shown, phase: "holding" }, delay: HOLD_MS }
        : { state: { ...state, shown }, delay: TYPE_MS };
    }
    case "holding":
      // The first deletion step takes one character, the following ones one to three.
      return deleted(state, 1);
    case "deleting":
      return deleted(state, 1 + (state.shown % 3));
    case "waiting":
      return { state: { phrase: (state.phrase + 1) % phrases.length, shown: 0, phase: "typing" }, delay: TYPE_MS };
  }
}

function deleted(state: TypewriterState, count: number): { state: TypewriterState; delay: number } {
  const shown = Math.max(0, state.shown - count);
  return shown === 0
    ? { state: { ...state, shown, phase: "waiting" }, delay: WAIT_MS }
    : { state: { ...state, shown, phase: "deleting" }, delay: TYPE_MS };
}

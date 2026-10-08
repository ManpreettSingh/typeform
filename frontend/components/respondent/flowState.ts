import type { AnswerValue, Answers } from "@/lib/types";

/** welcome (optional) → question[index] → … → done (thank-you). Submitting is a flag on the last question. */
export type FlowStep = "welcome" | "question" | "done";

export type FlowState = {
  step: FlowStep;
  index: number;
  /** 1 = forward, -1 = back; drives the slide direction. */
  direction: 1 | -1;
  answers: Answers;
  /** Error message per question id. */
  errors: Record<number, string>;
  /** Bumped on every rejected attempt so the error shakes again. */
  attempt: number;
  submitting: boolean;
};

export type FlowAction =
  | { type: "start" }
  | { type: "answer"; id: number; value: AnswerValue | undefined }
  | { type: "go"; index: number }
  /** Show errors; with `index`, also jump to that question (e.g. a server 422). */
  | { type: "reject"; errors: Record<number, string>; index?: number }
  | { type: "submit" }
  | { type: "submitFailed" }
  | { type: "finish" };

export function initialFlowState(hasWelcome: boolean): FlowState {
  return {
    step: hasWelcome ? "welcome" : "question",
    index: 0,
    direction: 1,
    answers: {},
    errors: {},
    attempt: 0,
    submitting: false,
  };
}

const moveTo = (state: FlowState, index: number): Pick<FlowState, "index" | "direction"> => ({
  index,
  direction: index >= state.index ? 1 : -1,
});

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "start":
      return { ...state, step: "question", index: 0, direction: 1 };
    case "answer": {
      const errors = { ...state.errors };
      delete errors[action.id];
      return { ...state, answers: { ...state.answers, [action.id]: action.value }, errors };
    }
    case "go":
      return { ...state, ...moveTo(state, action.index) };
    case "reject":
      return {
        ...state,
        ...(action.index !== undefined && moveTo(state, action.index)),
        errors: { ...state.errors, ...action.errors },
        attempt: state.attempt + 1,
        submitting: false,
      };
    case "submit":
      return { ...state, submitting: true };
    case "submitFailed":
      return { ...state, submitting: false };
    case "finish":
      return { ...state, step: "done", direction: 1, submitting: false };
  }
}

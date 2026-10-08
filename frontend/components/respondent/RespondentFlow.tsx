"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import { ApiError, getErrorMessage } from "@/lib/api";
import type { Answers, PublicQuestion, ThankYou } from "@/lib/types";
import { canEndAfter, nextIndex, visitedPath } from "@/lib/logic";
import { isEmptyAnswer, validateAnswer } from "@/lib/validation";
import { flowReducer, initialFlowState } from "./flowState";
import { QuestionRenderer } from "./QuestionRenderer";
import { ThankYouScreen } from "./ThankYouScreen";
import { WelcomeScreen } from "./WelcomeScreen";

type Props = {
  questions: PublicQuestion[];
  thankYou: ThankYou;
  /** Shows a welcome screen before the first question. */
  welcome?: { title: string; description: string } | null;
  /**
   * Called with all answers after the last question validates. Throw an `ApiError` 422 keyed by question id
   * to send the respondent back to the offending question. Omit for a local, non-persisting run.
   */
  onComplete?: (answers: Answers) => Promise<void>;
  /** Called with all answers each time the respondent moves forward to another question (partial responses). */
  onProgress?: (answers: Answers) => void;
};

const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;
const SHIFT_PX = 60;
const SUBMIT_TOAST_ID = "respondent-submit";

const isTextEntry = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === "TEXTAREA" || target.getAttribute("role") === "combobox" ||
    (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "button"));

/** One-question-at-a-time respondent flow with progress, keyboard navigation and welcome/thank-you screens. */
export function RespondentFlow({ questions, thankYou, welcome, onComplete, onProgress }: Props) {
  const [state, dispatch] = useReducer(flowReducer, Boolean(welcome), initialFlowState);
  // Handlers read the latest state from here: auto-advance timers and toast actions outlive the render that made them.
  const stateRef = useRef(state);
  // Set synchronously so a fast double Enter can't start two submissions.
  const submittingRef = useRef(false);
  const slideRef = useRef<HTMLDivElement>(null);
  // Latest `submit`, for the toast's Retry action.
  const submitRef = useRef<() => Promise<void>>(async () => {});
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const current = questions[state.index];
  // No questions (an empty preview) or a stale index: nothing left to ask.
  const step = state.step === "question" && !current ? "done" : state.step;
  // Branching: the path ahead depends on the answers so far, so progress and "n of N" follow it.
  const path = visitedPath(questions, state.answers);
  const answered = path.filter((i) => !isEmptyAnswer(state.answers[questions[i].id])).length;
  const position = state.history.length + 1;
  const total = Math.max(path.length, position);
  const isLast = Boolean(current) && nextIndex(questions, state.index, state.answers) === null;

  const submit = useCallback(async () => {
    const { answers } = stateRef.current;
    if (submittingRef.current) return;

    // Each question was checked on the way here, but answers can be cleared after going back.
    const path = visitedPath(questions, answers);
    const invalid = path.findIndex((i) => validateAnswer(questions[i], answers[questions[i].id]));
    if (invalid !== -1) {
      const q = questions[path[invalid]];
      const errors = { [q.id]: validateAnswer(q, answers[q.id])! };
      return dispatch({ type: "reject", errors, index: path[invalid], history: path.slice(0, invalid) });
    }
    if (!onComplete) return dispatch({ type: "finish" });

    submittingRef.current = true;
    dispatch({ type: "submit" });
    try {
      await onComplete(answers);
      // Only now: a dismissal still pending when a fast failure re-creates the same id removes the new toast.
      toast.dismiss(SUBMIT_TOAST_ID);
      dispatch({ type: "finish" });
    } catch (error) {
      handleSubmitError(error);
    } finally {
      submittingRef.current = false;
    }

    function handleSubmitError(error: unknown) {
      if (error instanceof ApiError && error.status === 422) {
        const errors: Record<number, string> = {};
        for (const q of questions) if (error.fieldErrors[q.id]) errors[q.id] = error.fieldErrors[q.id];
        const path = visitedPath(questions, stateRef.current.answers);
        const first = path.findIndex((i) => questions[i].id in errors);
        if (first !== -1) return dispatch({ type: "reject", errors, index: path[first], history: path.slice(0, first) });
      }
      dispatch({ type: "submitFailed" });

      if (error instanceof ApiError && (error.status === 404 || error.status === 422)) {
        // Unpublished or edited since this page loaded; retrying the same answers won't help.
        toast.error(
          error.status === 404
            ? "This form is no longer accepting responses."
            : "This form was updated while you were filling it in. Reload the page to continue.",
          { id: SUBMIT_TOAST_ID, duration: Infinity },
        );
        return;
      }
      toast.error(getErrorMessage(error), {
        id: SUBMIT_TOAST_ID,
        duration: Infinity,
        action: { label: "Retry", onClick: () => void submitRef.current() },
      });
    }
  }, [onComplete, questions]);

  useLayoutEffect(() => {
    submitRef.current = submit;
  });

  const goNext = useCallback(() => {
    const s = stateRef.current;
    if (s.step === "welcome") return dispatch({ type: "start" });
    const question = questions[s.index];
    if (s.step !== "question" || !question || s.submitting) return;

    const error = validateAnswer(question, s.answers[question.id]);
    if (error) return dispatch({ type: "reject", errors: { [question.id]: error } });
    const next = nextIndex(questions, s.index, s.answers);
    if (next === null) return void submit();
    onProgress?.(s.answers);
    dispatch({ type: "go", index: next });
  }, [onProgress, questions, submit]);

  // ↓ only moves between questions; submitting takes an explicit OK / Enter on the last one.
  const goDown = useCallback(() => {
    const s = stateRef.current;
    if (s.step !== "question" || (questions[s.index] && nextIndex(questions, s.index, s.answers) !== null)) goNext();
  }, [goNext, questions]);

  const goPrev = useCallback(() => {
    const s = stateRef.current;
    if (s.step === "question" && s.history.length > 0 && !s.submitting) dispatch({ type: "back" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = isTextEntry(e.target);
      // Buttons activate natively on Enter; text fields handle their own Enter.
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && !typing) {
        e.preventDefault();
        goNext();
      } else if (!typing && (e.key === "ArrowDown" || e.key === "PageDown")) {
        e.preventDefault();
        goDown();
      } else if (!typing && (e.key === "ArrowUp" || e.key === "PageUp")) {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape" && typing) {
        // Leave the field (keeps the answer) so ↑/↓ navigate again.
        slideRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goDown, goNext, goPrev]);

  const shift = reduceMotion ? 0 : SHIFT_PX;
  const variants: Variants = {
    enter: (dir: number) => ({ y: dir * shift, opacity: 0 }),
    center: { y: 0, opacity: 1, transition: { duration: 0.35, ease: EASE_OUT_CUBIC } },
    exit: (dir: number) => ({ y: -dir * shift, opacity: 0, transition: { duration: 0.25, ease: EASE_OUT_CUBIC } }),
  };

  const slideKey = step === "question" ? current.id : step;
  let content: ReactNode;
  if (step === "welcome" && welcome) {
    content = <WelcomeScreen {...welcome} onStart={goNext} />;
  } else if (step === "done") {
    content = <ThankYouScreen thankYou={thankYou} />;
  } else {
    content = (
      <QuestionRenderer
        question={current}
        number={state.index + 1}
        value={state.answers[current.id]}
        onChange={(value) => dispatch({ type: "answer", id: current.id, value })}
        onSubmit={goNext}
        error={state.errors[current.id]}
        errorKey={state.attempt}
        mode="live"
        isLast={isLast}
        canEnd={canEndAfter(questions, state.index)}
        submitting={state.submitting}
      />
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {step === "question" && (
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-valuetext={`${answered} of ${total} answered`}
          className="h-1 w-full shrink-0 bg-resp-accent/20"
        >
          <motion.div
            className="h-full bg-resp-accent"
            initial={false}
            animate={{ width: `${(answered / total) * 100}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.3 }}
          />
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={state.direction} initial={false}>
          <Slide key={slideKey} slideRef={slideRef} custom={state.direction} variants={variants}>
            {content}
          </Slide>
        </AnimatePresence>
      </div>

      {step === "question" && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-end gap-3 sm:inset-x-6 sm:bottom-6">
          <span aria-hidden className="rounded-input bg-resp-bg/80 px-2 py-1 text-xs opacity-70 sm:text-sm">
            {position} of {total}
          </span>
          <div className="pointer-events-auto flex overflow-hidden rounded-resp-button">
            <NavButton label="Previous question" disabled={state.history.length === 0 || state.submitting} onClick={goPrev}>
              <ChevronUp className="size-5" aria-hidden />
            </NavButton>
            <NavButton label="Next question" disabled={isLast || state.submitting} onClick={goDown}>
              <ChevronDown className="size-5" aria-hidden />
            </NavButton>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One animated screen. On mount it takes focus unless an input inside already did (answer components
 * autofocus their field), so keyboard and screen-reader users always land on the new question.
 */
function Slide({
  slideRef,
  custom,
  variants,
  children,
}: {
  slideRef: RefObject<HTMLDivElement | null>;
  custom: number;
  variants: Variants;
  children: ReactNode;
}) {
  useEffect(() => {
    const el = slideRef.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [slideRef]);

  return (
    <motion.div
      ref={slideRef}
      tabIndex={-1}
      custom={custom}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      className="flex flex-1 items-center justify-center overflow-y-auto px-6 pt-16 pb-20 outline-none sm:px-10"
    >
      {children}
    </motion.div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex size-9 items-center justify-center bg-resp-accent text-resp-accent-fg transition-opacity",
        "hover:opacity-90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-resp-accent-fg",
        "disabled:opacity-40 [&+&]:border-l [&+&]:border-resp-accent-fg/20",
      )}
    >
      {children}
    </button>
  );
}

import { useEffect, useRef, type KeyboardEvent } from "react";

/** Typeform's answer line: a thin underline that thickens on focus (box-shadow, so the text doesn't shift). */
export const FIELD_LINE =
  "border-b border-resp-accent/30 bg-transparent pb-2 text-2xl font-light text-resp-accent " +
  "placeholder:text-resp-accent/40 focus:border-resp-accent focus:shadow-[0_1px_0_var(--resp-accent)] focus:outline-none " +
  "sm:text-3xl";

/** The full-width answer line used by most types. */
export const FIELD = `w-full ${FIELD_LINE}`;

/** Focuses the element in the live form (never in the builder's preview). */
export function useAutofocus<T extends HTMLElement>(live: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (live) ref.current?.focus({ preventScroll: true });
  }, [live]);
  return ref;
}

/** Enter submits (Shift+Enter is left alone for line breaks). */
export function submitOnEnter(onSubmit: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault(); // handled here; the flow's global Enter listener skips prevented events
    onSubmit();
  };
}

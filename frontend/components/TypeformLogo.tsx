import { clsx } from "clsx";

/**
 * Typeform's mark (a pill next to a rounded square), redrawn as SVG, with an optional wordmark.
 * This is an unofficial clone: the name and mark belong to Typeform. Used only in the creator UI,
 * never on public form pages, so respondents can't mistake a clone form for a real Typeform one.
 */
export function TypeformLogo({ wordmark = false, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-text", className)}>
      <svg viewBox="0 0 30 20" className="h-4 w-auto shrink-0" aria-hidden>
        <rect x="0" y="0" width="7" height="20" rx="3.5" fill="currentColor" />
        <rect x="9.5" y="0" width="20" height="20" rx="6" fill="currentColor" />
      </svg>
      {wordmark ? <span className="text-[15px] font-semibold tracking-tight">Typeform</span> : <span className="sr-only">Typeform</span>}
    </span>
  );
}

/** Just the pill: in Typeform's workspace bar the square half of the mark is the account avatar. */
export function TypeformPill({ className }: { className?: string }) {
  return <span aria-hidden className={clsx("block h-8 w-2.5 shrink-0 rounded-pill bg-text", className)} />;
}

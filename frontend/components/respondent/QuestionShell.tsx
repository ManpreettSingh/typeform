import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  number: number;
  title: string;
  titleId: string;
  groupTitle?: string | null;
  description: string | null;
  required: boolean;
  error?: string | null;
  /** Changes on every rejected attempt; re-keys the error so it shakes again. */
  errorKey?: number;
  submitLabel: string;
  /** Final submit in flight: the button shows a spinner and ignores clicks. */
  submitting?: boolean;
  onSubmit: () => void;
  /** Extra hint under the input, e.g. the long-text line-break tip. */
  hint?: ReactNode;
  /** Builder canvas: editable fields shown in place of the title and description. */
  titleSlot?: ReactNode;
  descriptionSlot?: ReactNode;
  children: ReactNode;
};

/** Typeform-style question layout: square number badge, big title, help text, answer, OK + "press Enter". */
export function QuestionShell({
  number,
  title,
  titleId,
  groupTitle,
  description,
  required,
  error,
  errorKey,
  submitLabel,
  submitting,
  onSubmit,
  hint,
  titleSlot,
  descriptionSlot,
  children,
}: Props) {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Typeform's current badge: a small square in the question color with the number knocked out. */}
        <span
          aria-hidden
          className="mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-[4px] bg-resp-text text-[11px] font-semibold text-resp-bg sm:mt-2"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          {groupTitle && (
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-resp-text/60">
              {groupTitle}
            </p>
          )}
          {titleSlot ?? (
            <h2 id={titleId} className="text-xl leading-snug break-words sm:text-[26px] sm:leading-[34px]">
              <span className="sr-only">Question {number}: </span>
              {title.trim() || <span className="opacity-50">Your question here.</span>}
              {required && (
                <span aria-label="required">
                  {" "}
                  *
                </span>
              )}
            </h2>
          )}
          {descriptionSlot ??
            (description && (
              <p className="mt-2 text-base break-words whitespace-pre-line opacity-70 sm:text-lg">{description}</p>
            ))}

          <div className="mt-6 sm:mt-8">{children}</div>
          {hint && <p className="mt-2 text-xs opacity-60">{hint}</p>}

          <div className="mt-6 flex min-h-10 flex-wrap items-center gap-3">
            {error ? (
              <p
                key={errorKey}
                role="alert"
                className="inline-flex animate-shake items-center gap-2 rounded-input bg-resp-error-soft px-3 py-1.5 text-sm text-resp-error"
              >
                <AlertTriangle className="size-4" aria-hidden />
                {error}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  aria-busy={submitting || undefined}
                  className="inline-flex items-center gap-1.5 rounded-resp-button bg-resp-accent px-4 py-2 text-base font-semibold text-resp-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent disabled:cursor-wait disabled:opacity-70 sm:text-lg"
                >
                  {submitting ? "Submitting…" : submitLabel}
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                </button>
                {!submitting && (
                  <span className="hidden text-xs opacity-60 sm:inline">
                    press <strong>Enter ↵</strong>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

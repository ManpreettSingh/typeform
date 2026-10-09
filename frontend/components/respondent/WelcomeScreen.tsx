import { useEffect, useRef } from "react";

/** Optional first screen: form title, description and a Start button (Enter works too). */
export function WelcomeScreen({ 
  title, 
  description, 
  button_text = "Start",
  show_time_to_complete = false,
  show_submission_count = false,
  submission_count = null,
  onStart 
}: { 
  title: string; 
  description: string; 
  button_text?: string;
  show_time_to_complete?: boolean;
  show_submission_count?: boolean;
  submission_count?: number | null;
  onStart: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);

  // Focused so Enter starts natively and keyboard users land on the only action. No focus ring until the
  // respondent actually uses the keyboard (Typeform doesn't show one on load either).
  useEffect(() => {
    startRef.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  }, []);

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 text-center">
      <h1 className="text-2xl leading-snug break-words sm:text-3xl">{title}</h1>
      <p className="text-lg break-words whitespace-pre-line opacity-70">{description}</p>
      
      {(show_time_to_complete || (show_submission_count && submission_count != null)) && (
        <div className="flex gap-4 text-sm opacity-60">
          {show_time_to_complete && <span>Takes 5 minutes</span>}
          {show_submission_count && submission_count != null && <span>{submission_count} submissions</span>}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          ref={startRef}
          type="button"
          onClick={onStart}
          className="rounded-resp-button bg-resp-accent px-5 py-2.5 text-lg font-semibold text-resp-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent"
        >
          {button_text}
        </button>
        <span className="hidden text-xs opacity-60 sm:inline">
          press <strong>Enter ↵</strong>
        </span>
      </div>
    </div>
  );
}

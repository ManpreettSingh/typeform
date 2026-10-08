import { useEffect, useRef } from "react";

/** Optional first screen: form title, description and a Start button (Enter works too). */
export function WelcomeScreen({ title, description, onStart }: { title: string; description: string; onStart: () => void }) {
  const startRef = useRef<HTMLButtonElement>(null);

  // Focused so Enter starts natively and keyboard users land on the only action.
  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 text-center">
      <h1 className="text-2xl leading-snug break-words sm:text-3xl">{title}</h1>
      <p className="text-lg break-words whitespace-pre-line opacity-70">{description}</p>
      <div className="mt-4 flex items-center gap-3">
        <button
          ref={startRef}
          type="button"
          onClick={onStart}
          className="rounded-input bg-resp-accent px-5 py-2.5 text-lg font-semibold text-resp-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent"
        >
          Start
        </button>
        <span className="hidden text-xs opacity-60 sm:inline">
          press <strong>Enter ↵</strong>
        </span>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import type { AnswerProps } from "./types";

export function StatementScreen({ question, onSubmit, live }: AnswerProps<"statement">) {
  useEffect(() => {
    if (!live) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSubmit, live]);

  return (
    <div className="w-full max-w-3xl">
      <div className="flex flex-col gap-6">
        <div className="text-2xl font-bold">
          {!question.properties.hide_marks && <span className="text-gray-400 mr-2">&quot;</span>}
          {question.title || "..."}
          {!question.properties.hide_marks && <span className="text-gray-400 ml-2">&quot;</span>}
        </div>
        
        {question.description && (
          <div className="text-lg text-gray-600">
            {question.description}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-resp-button bg-resp-accent px-5 py-2.5 text-lg font-semibold text-resp-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent"
          >
            {question.properties.button_text || "Continue"}
          </button>
          <span className="hidden text-xs opacity-60 sm:inline">
            press <strong>Enter ↵</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

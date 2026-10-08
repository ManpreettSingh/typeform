"use client";

import { clsx } from "clsx";
import { Heart, Star } from "lucide-react";
import { useState } from "react";
import { AUTO_ADVANCE_MS, type AnswerProps } from "../types";
import { useDelayedCall, useShortcutKeys } from "./useShortcutKeys";

export function RatingAnswer({ question, value, onChange, onSubmit, live, autoAdvance, labelledBy }: AnswerProps<"rating">) {
  const { max, shape } = question.properties;
  const [hovered, setHovered] = useState<number | null>(null);
  const later = useDelayedCall();
  const shown = hovered ?? value ?? 0;
  const Icon = shape === "heart" ? Heart : Star;

  function pick(rating: number) {
    onChange(rating);
    if (autoAdvance) later(onSubmit, AUTO_ADVANCE_MS);
  }

  // 1–9, and 0 for 10.
  useShortcutKeys(live, (key) => {
    const n = key === "0" ? 10 : Number(key);
    if (!Number.isInteger(n) || n < 1 || n > max) return false;
    pick(n);
    return true;
  });

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-1 sm:gap-2"
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const active = n <= shown;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of ${max}`}
            onClick={() => pick(n)}
            onMouseEnter={() => setHovered(n)}
            className={clsx(
              "flex flex-col items-center gap-1 rounded-input text-sm text-resp-accent transition-transform",
              "hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent",
              shape === "number" && "size-11 justify-center border border-resp-accent/40 sm:size-14",
              shape === "number" && (value === n ? "bg-resp-accent text-resp-accent-fg" : "bg-resp-accent/10"),
            )}
          >
            {shape === "number" ? (
              <span className="text-lg sm:text-xl">{n}</span>
            ) : (
              <>
                <Icon
                  aria-hidden
                  strokeWidth={1.5}
                  className={clsx("size-9 sm:size-11", active && "fill-resp-accent")}
                />
                <span aria-hidden>{n}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

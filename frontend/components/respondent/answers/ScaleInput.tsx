"use client";

import { clsx } from "clsx";
import { useId, useRef } from "react";
import type { ScaleLabels } from "@/lib/types";
import { AUTO_ADVANCE_MS } from "../types";
import { useDelayedCall, useShortcutKeys } from "./useShortcutKeys";

/** Two number keys typed within this time make one number ("1" then "0" is 10), so a first key waits this long. */
const KEY_PAIR_MS = 800;

type Props = {
  /** First and last step. */
  range: readonly [number, number];
  labels: ScaleLabels;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onSubmit: () => void;
  live: boolean;
  autoAdvance: boolean;
  labelledBy: string;
};

/** A row of numbered boxes with captions under the left end, the middle and the right end (opinion scale and NPS). */
export function ScaleInput({ range: [low, high], labels, value, onChange, onSubmit, live, autoAdvance, labelledBy }: Props) {
  const later = useDelayedCall();
  const typed = useRef<{ digits: string; at: number } | null>(null);
  const captionsId = useId();
  const steps = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const hasCaptions = Boolean(labels.left || labels.center || labels.right);

  function pick(step: number, advanceAfterMs = AUTO_ADVANCE_MS) {
    onChange(step);
    if (autoAdvance) later(onSubmit, advanceAfterMs);
  }

  // Number keys choose a step; a second key soon after the first adds a digit (1, 0 → 10).
  useShortcutKeys(live, (key) => {
    if (!/^\d$/.test(key)) return false;
    const now = Date.now();
    const recent = typed.current && now - typed.current.at < KEY_PAIR_MS ? typed.current.digits : "";
    let digits = recent + key;
    if (digits.length > 1 && (digits.startsWith("0") || Number(digits) > high)) digits = key;
    const step = Number(digits);
    if (step < low || step > high) return false;
    typed.current = { digits, at: now };
    // "1" might be the start of "10": give the second key time before moving on.
    pick(step, step !== 0 && step * 10 <= high ? KEY_PAIR_MS : AUTO_ADVANCE_MS);
    return true;
  });

  return (
    <div className="w-full">
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={hasCaptions ? captionsId : undefined}
        className="grid gap-1 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={value === step}
            onClick={() => pick(step)}
            className={clsx(
              "flex h-11 items-center justify-center rounded-input border text-base tabular-nums transition-colors sm:h-14 sm:text-xl",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent",
              value === step
                ? "border-resp-accent bg-resp-accent text-resp-accent-fg"
                : "border-resp-accent/40 bg-resp-accent/10 text-resp-accent hover:bg-resp-accent/20",
            )}
          >
            {step}
          </button>
        ))}
      </div>
      {hasCaptions && (
        <div id={captionsId} className="mt-2 grid grid-cols-3 gap-2 text-sm break-words opacity-80">
          <span className="text-left">{labels.left}</span>
          <span className="text-center">{labels.center}</span>
          <span className="text-right">{labels.right}</span>
        </div>
      )}
    </div>
  );
}

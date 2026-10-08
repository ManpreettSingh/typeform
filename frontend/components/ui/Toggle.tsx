"use client";

import { clsx } from "clsx";
import { useId } from "react";

export type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
};

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  const autoId = useId();
  const toggleId = id ?? autoId;

  return (
    <div className="inline-flex items-center gap-3">
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          // Typeform's small switch: light track + dark knob when off, dark track + white knob when on.
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-pill transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-text-muted" : "bg-bg-hover",
        )}
      >
        <span
          className={clsx(
            "inline-block size-2.5 rounded-pill transition-[transform,background-color] duration-200 ease-out-cubic",
            checked ? "translate-x-[15px] bg-bg" : "translate-x-[3px] bg-text-muted",
          )}
        />
      </button>
      {label && (
        <label htmlFor={toggleId} className="cursor-pointer text-sm text-text select-none">
          {label}
        </label>
      )}
    </div>
  );
}

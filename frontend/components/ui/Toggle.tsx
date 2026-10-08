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
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill transition-colors duration-200",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          className={clsx(
            "inline-block size-4 rounded-pill bg-bg shadow-sm transition-transform duration-200 ease-out-cubic",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
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

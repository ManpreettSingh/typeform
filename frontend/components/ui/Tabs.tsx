"use client";

import { clsx } from "clsx";
import { useRef, type KeyboardEvent } from "react";

export type TabItem<T extends string> = { value: T; label: string; disabled?: boolean };

export type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
};

export function Tabs<T extends string>({ items, value, onChange, className, ...aria }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving arrow-key focus per the WAI-ARIA tabs pattern.
  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    for (let i = 1; i <= items.length; i++) {
      const next = (index + step * i + items.length) % items.length;
      if (!items[next].disabled) {
        refs.current[next]?.focus();
        onChange(items[next].value);
        return;
      }
    }
  }

  return (
    <div role="tablist" aria-label={aria["aria-label"]} className={clsx("flex items-center gap-1", className)}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={clsx(
              "relative h-9 px-3 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "text-text" : "text-text-soft hover:text-text",
            )}
          >
            {item.label}
            {selected && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-pill bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

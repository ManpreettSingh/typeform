"use client";

import { clsx } from "clsx";
import { forwardRef, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** Enter inserts a newline instead of blurring (descriptions). */
  multiline?: boolean;
  /** Width follows the text (so e.g. a required "*" can sit right after a title) instead of filling the row. */
  fit?: boolean;
};

/**
 * Text edited in place on the builder canvas, styled by the surrounding form theme (Typeform edits titles,
 * descriptions and choices right on the canvas). Grows with its content; Enter / Escape leave the field.
 */
export const InlineText = forwardRef<HTMLTextAreaElement, Props>(function InlineText(
  { value, onChange, multiline = false, fit = false, className, onKeyDown, ...props },
  forwarded,
) {
  const local = useRef<HTMLTextAreaElement | null>(null);

  // Fallback for browsers without `field-sizing: content`.
  useLayoutEffect(() => {
    const el = local.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        local.current = el;
        if (typeof forwarded === "function") forwarded(el);
        else if (forwarded) forwarded.current = el;
      }}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey && !multiline)) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={clsx(
        "block resize-none overflow-hidden rounded-[4px] bg-transparent [field-sizing:content]",
        fit ? "max-w-full min-w-[4ch]" : "w-full",
        "placeholder:italic placeholder:opacity-50 hover:bg-resp-text/5 focus:bg-resp-text/5 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

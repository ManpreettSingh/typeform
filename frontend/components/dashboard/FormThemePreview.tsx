import { clsx } from "clsx";
import { themeStyle } from "@/lib/theme";
import type { Theme } from "@/lib/types";

/*
 * A form drawn in its own theme colors (background, text, button, font), like Typeform's workspace previews.
 * Uses the same --resp-* variables as the public form, so it never follows the app's light/dark mode.
 */

/** 32px square for the list view: background, a line of "question" text and a tiny button. */
export function FormThemeIcon({ theme, className }: { theme: Theme; className?: string }) {
  return (
    <span
      aria-hidden
      style={themeStyle(theme)}
      className={clsx(
        "flex size-8 shrink-0 flex-col justify-center gap-1 rounded-field bg-resp-bg px-1.5",
        // A hairline keeps very light form backgrounds visible on white rows.
        "shadow-[inset_0_0_0_1px_rgb(42_34_43/0.1)]",
        className,
      )}
    >
      <span className="h-[3px] w-4 rounded-pill bg-resp-text opacity-70" />
      <span className="h-[5px] w-2.5 rounded-[2px] bg-resp-accent" />
    </span>
  );
}

/** Card thumbnail for the grid view: the title set like the form's first screen, plus its Start button. */
export function FormThemeThumb({ theme, title, children }: { theme: Theme; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div
      style={themeStyle(theme)}
      className="flex aspect-[16/10] flex-col items-start justify-end gap-3 bg-resp-bg p-4 font-resp text-resp-text"
    >
      <h3 className="line-clamp-2 text-base leading-snug break-words">{title}</h3>
      <span aria-hidden className="rounded-[4px] bg-resp-accent px-2 py-0.5 text-[11px] font-semibold text-resp-accent-fg">
        Start
      </span>
      {children}
    </div>
  );
}

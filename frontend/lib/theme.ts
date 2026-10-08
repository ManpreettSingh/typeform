import type { CSSProperties } from "react";
import type { ThankYou, Theme } from "@/lib/types";

// Mirrors backend defaults (schemas/form.py) so the UI can offer "Reset to default".
export const DEFAULT_THEME: Theme = {
  background: "#FFFFFF",
  text_color: "#262627",
  button_color: "#0445AF",
  font: "Inter",
};

export const DEFAULT_THANK_YOU: ThankYou = {
  title: "Thanks for completing this form",
  message: "Your response has been recorded.",
  button_text: null,
  button_url: null,
};

/** Fonts a creator can pick. Only Inter is downloaded; the rest are system stacks. */
export const FONT_OPTIONS = [
  { value: "Inter", label: "Inter", stack: "var(--font-inter), system-ui, sans-serif" },
  { value: "System", label: "System UI", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { value: "Georgia", label: "Georgia (serif)", stack: "Georgia, 'Times New Roman', serif" },
  { value: "Courier", label: "Courier (mono)", stack: "'Courier New', ui-monospace, monospace" },
] as const;

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function fontStack(font: string): string {
  return (FONT_OPTIONS.find((f) => f.value === font) ?? FONT_OPTIONS[0]).stack;
}

/** Relative luminance (WCAG) of a #RRGGBB color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** CSS variables that re-skin everything under components/respondent for one form. */
export function themeStyle(theme: Theme): CSSProperties {
  const safe = (color: string, fallback: string) => (HEX_COLOR.test(color) ? color : fallback);
  const button = safe(theme.button_color, DEFAULT_THEME.button_color);
  return {
    "--resp-bg": safe(theme.background, DEFAULT_THEME.background),
    "--resp-text": safe(theme.text_color, DEFAULT_THEME.text_color),
    "--resp-accent": button,
    // Keep button labels readable on light button colors. --ink/--paper don't change with the app's dark mode:
    // a form looks the same whatever theme the creator's UI is in.
    "--resp-accent-fg": luminance(button) > 0.5 ? "var(--ink)" : "var(--paper)",
    "--resp-font": fontStack(theme.font),
    // Native controls (scrollbars, the dropdown's list) follow the form's background, not the app theme.
    colorScheme: luminance(safe(theme.background, DEFAULT_THEME.background)) > 0.4 ? "light" : "dark",
  } as CSSProperties;
}

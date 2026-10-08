import { clsx } from "clsx";
import type { ReactNode } from "react";
import { themeStyle } from "@/lib/theme";
import type { Theme } from "@/lib/types";

/** Applies a form's theme to every respondent component inside it (via --resp-* variables). */
export function RespondentTheme({
  theme,
  className,
  children,
}: {
  theme: Theme;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div style={themeStyle(theme)} className={clsx("bg-resp-bg font-resp text-resp-text", className)}>
      {children}
    </div>
  );
}

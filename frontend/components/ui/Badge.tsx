import { clsx } from "clsx";
import type { ReactNode } from "react";

export type BadgeVariant = "neutral" | "success" | "accent" | "danger";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-bg-hover text-text-muted",
  success: "border border-success-line bg-success-soft text-success",
  // Typeform's "Beta" / "Soon" badge.
  accent: "border border-badge-line bg-badge-bg text-badge-text",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

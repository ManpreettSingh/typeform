import { clsx } from "clsx";
import type { ReactNode } from "react";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
};

export function EmptyState({ icon, title, description, action, tone = "neutral", className }: EmptyStateProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={clsx("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}
    >
      {icon && (
        <div
          className={clsx(
            "mb-1 flex size-12 items-center justify-center rounded-pill",
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-bg-subtle text-text-muted",
          )}
        >
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

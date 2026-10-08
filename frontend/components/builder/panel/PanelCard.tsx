"use client";

import { clsx } from "clsx";
import { useId, type ReactNode } from "react";
import { Toggle } from "@/components/ui";

/** One rounded settings card in the builder's side panels (Typeform's "Question", "Answer", "Logic" cards). */
export function PanelCard({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-card bg-bg-subtle p-4", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-text">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label on the left, control on the right. */
export function SettingRow({ label, htmlFor, children }: { label: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 text-sm text-text-muted">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="cursor-pointer">
          {label}
        </label>
      ) : (
        <span>{label}</span>
      )}
      {children}
    </div>
  );
}

/** A switch row; `children` (e.g. an input) shows under it while it's on, like Typeform's "Max characters". */
export function SwitchRow({
  label,
  checked,
  onChange,
  disabled,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <SettingRow label={label} htmlFor={id}>
        <Toggle id={id} checked={checked} onChange={onChange} disabled={disabled} />
      </SettingRow>
      {checked && children && <div className="pb-2">{children}</div>}
    </div>
  );
}

export function PanelDivider() {
  return <div role="separator" className="my-2 border-t border-border" />;
}

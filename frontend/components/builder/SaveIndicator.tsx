"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useBuilderStore } from "@/store/builderStore";

const STATES = {
  saving: { icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />, label: "Saving…", tone: "text-text-muted" },
  saved: { icon: <Check className="size-3.5" aria-hidden />, label: "Saved", tone: "text-text-muted" },
  error: { icon: <AlertCircle className="size-3.5" aria-hidden />, label: "Not saved", tone: "text-danger" },
} as const;

export function SaveIndicator() {
  const status = useBuilderStore((s) => s.saveStatus);
  const { icon, label, tone } = STATES[status];

  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs ${tone}`}>
      {icon}
      {label}
    </span>
  );
}

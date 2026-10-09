"use client";

import { Input } from "@/components/ui";
import { SCALE_LABEL_MAX, type ScaleLabels } from "@/lib/types";

const SIDES = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
  { key: "right", label: "Right" },
] as const;

/** The captions under a scale's left end, middle and right end; any may stay empty. */
export function ScaleLabelsFields({ labels, onChange }: { labels: ScaleLabels; onChange: (labels: ScaleLabels) => void }) {
  return (
    <div className="flex flex-col gap-2 py-2">
      <span className="text-sm text-text-muted">Labels</span>
      {SIDES.map(({ key, label }) => (
        <Input
          key={key}
          aria-label={`${label} label`}
          placeholder={label}
          maxLength={SCALE_LABEL_MAX}
          value={labels[key]}
          onChange={(e) => onChange({ ...labels, [key]: e.target.value })}
        />
      ))}
    </div>
  );
}

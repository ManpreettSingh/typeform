"use client";

import { Input } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import type { QuestionOf, CompositeField } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

type FieldListProps = {
  question: QuestionOf<"contact_info"> | QuestionOf<"address">;
};

export function FieldListSettings({ question }: FieldListProps) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const fields = question.properties.fields;

  const updateField = (index: number, updates: Partial<CompositeField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    updateQuestion(question.id, { properties: { fields: next } });
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      {fields.map((f, i) => (
        <div key={f.key} className="flex flex-col gap-2 rounded-field bg-bg-subtle p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">{f.label || f.key}</span>
            <Toggle checked={f.enabled} onChange={(checked) => updateField(i, { enabled: checked })} />
          </div>
          {f.enabled && (
            <div className="flex flex-col gap-3 pt-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-text-muted">Label</span>
                <Input
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text">Required</span>
                <Toggle checked={f.required} onChange={(checked) => updateField(i, { required: checked })} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

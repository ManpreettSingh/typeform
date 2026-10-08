"use client";

import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { QuestionRenderer } from "@/components/respondent/QuestionRenderer";
import { RespondentTheme } from "@/components/respondent/RespondentTheme";
import { Button, Select } from "@/components/ui";
import { DEFAULT_THEME, FONT_OPTIONS, HEX_COLOR } from "@/lib/theme";
import type { AnswerValue, Question, Theme } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

const THEME_DEBOUNCE_MS = 400;

type ColorKey = "background" | "text_color" | "button_color";
const COLORS: { key: ColorKey; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "text_color", label: "Questions & text" },
  { key: "button_color", label: "Buttons & answers" },
];

// Shown when the form has no questions yet.
const SAMPLE_QUESTION: Question = {
  id: -1,
  form_id: -1,
  type: "multiple_choice",
  title: "How did you hear about us?",
  description: "This is how your questions will look.",
  required: true,
  position: 0,
  properties: {
    options: [
      { id: "a", label: "A friend" },
      { id: "b", label: "Social media" },
    ],
    allow_multiple: false,
    allow_other: false,
  },
};

export function ThemeSettings() {
  const theme = useBuilderStore((s) => s.form!.theme);
  const firstQuestion = useBuilderStore((s) => s.questions[0]);
  const updateForm = useBuilderStore((s) => s.updateForm);
  const [sampleValue, setSampleValue] = useState<AnswerValue | undefined>();

  const setTheme = (patch: Partial<Theme>) => updateForm({ theme: { ...theme, ...patch } }, THEME_DEBOUNCE_MS);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 p-6 sm:p-10 lg:flex-row">
      <div className="flex flex-col gap-6 lg:w-72 lg:shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-text">Theme</h2>
          <p className="mt-1 text-sm text-text-muted">Applies to the preview and your public form.</p>
        </div>

        {COLORS.map(({ key, label }) => (
          <ColorField key={key} label={label} value={theme[key]} onChange={(color) => setTheme({ [key]: color })} />
        ))}

        <Select
          label="Font"
          options={FONT_OPTIONS.map(({ value, label }) => ({ value, label }))}
          value={FONT_OPTIONS.some((f) => f.value === theme.font) ? theme.font : DEFAULT_THEME.font}
          onChange={(font) => setTheme({ font })}
        />

        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          leftIcon={<RotateCcw className="size-4" aria-hidden />}
          onClick={() => updateForm({ theme: DEFAULT_THEME }, 0)}
        >
          Reset to default
        </Button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Preview</p>
        <RespondentTheme
          theme={theme}
          className="flex min-h-96 items-center justify-center rounded-card border border-border px-8 py-12"
        >
          <QuestionRenderer
            question={firstQuestion ?? SAMPLE_QUESTION}
            number={1}
            value={sampleValue}
            onChange={setSampleValue}
            onSubmit={() => {}}
            mode="preview"
          />
        </RespondentTheme>
      </div>
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const id = useId();
  // Free-typed hex is kept locally until it's a valid #RRGGBB.
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  const invalid = !HEX_COLOR.test(draft);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={HEX_COLOR.test(value) ? value.toLowerCase() : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-input border border-border-strong bg-bg p-1"
        />
        <input
          id={id}
          value={draft}
          maxLength={7}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const next = e.target.value.trim();
            setDraft(next);
            if (HEX_COLOR.test(next)) onChange(next.toUpperCase());
          }}
          className="h-10 w-full rounded-input border border-border-strong bg-bg px-3 font-mono text-sm text-text uppercase focus:border-accent focus:ring-2 focus:ring-accent-soft focus:outline-none aria-invalid:border-danger"
        />
      </div>
      {invalid && <p className="text-xs text-danger">Use a hex color like #0445AF</p>}
    </div>
  );
}

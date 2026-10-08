"use client";

import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { Button, Select } from "@/components/ui";
import { DEFAULT_THEME, FONT_OPTIONS, HEX_COLOR } from "@/lib/theme";
import type { Theme } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { PanelCard } from "../panel/PanelCard";

const THEME_DEBOUNCE_MS = 400;

type ColorKey = "background" | "text_color" | "button_color";
const COLORS: { key: ColorKey; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "text_color", label: "Questions & text" },
  { key: "button_color", label: "Buttons & answers" },
];

/** Typeform's Design panel: the form's colors and font. The canvas shows the result live. */
export function ThemeSettings() {
  const theme = useBuilderStore((s) => s.form!.theme);
  const updateForm = useBuilderStore((s) => s.updateForm);
  const fontId = useId();

  const setTheme = (patch: Partial<Theme>) => updateForm({ theme: { ...theme, ...patch } }, THEME_DEBOUNCE_MS);

  return (
    <PanelCard title="Design">
      <p className="mb-4 text-xs text-text-muted">Applies to this form&rsquo;s canvas and its public page.</p>
      <div className="flex flex-col gap-4">
        {COLORS.map(({ key, label }) => (
          <ColorField key={key} label={label} value={theme[key]} onChange={(color) => setTheme({ [key]: color })} />
        ))}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fontId} className="text-sm text-text-muted">
            Font
          </label>
          <Select
            id={fontId}
            options={FONT_OPTIONS.map(({ value, label }) => ({ value, label }))}
            value={FONT_OPTIONS.some((f) => f.value === theme.font) ? theme.font : DEFAULT_THEME.font}
            onChange={(font) => setTheme({ font })}
          />
        </div>
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
    </PanelCard>
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
      <label htmlFor={id} className="text-sm text-text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={HEX_COLOR.test(value) ? value.toLowerCase() : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-field border border-border-strong bg-field p-1"
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
          className="h-9 w-full rounded-field border border-border-strong bg-field px-3 font-mono text-sm text-text uppercase focus:border-text-muted focus:outline-none aria-invalid:border-danger"
        />
      </div>
      {invalid && <p className="text-xs text-danger">Use a hex color like #2A222B</p>}
    </div>
  );
}

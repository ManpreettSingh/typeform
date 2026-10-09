"use client";

import { ImageIcon, RotateCcw } from "lucide-react";
import { useId, useState, useRef, useCallback, useEffect } from "react";
import { Button, Select } from "@/components/ui";
import { DEFAULT_THEME, FONT_OPTIONS, HEX_COLOR, themeStyle } from "@/lib/theme";
import type { Theme } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { PanelCard } from "../panel/PanelCard";

const THEME_DEBOUNCE_MS = 400;

type ColorKey = "background" | "question" | "answer" | "button";
const COLORS: { key: ColorKey; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "question", label: "Questions & text" },
  { key: "answer", label: "Answers & inputs" },
  { key: "button", label: "Buttons & accents" },
];

export function ThemeSettings() {
  const theme = useBuilderStore((s) => s.form!.theme);
  const updateForm = useBuilderStore((s) => s.updateForm);
  const fontId = useId();

  const setTheme = (patch: Partial<Theme>) => updateForm({ theme: { ...theme, ...patch } }, THEME_DEBOUNCE_MS);

  return (
    <div className="flex flex-col gap-4 p-4">
      <PanelCard title="Design">
        <p className="mb-4 text-xs text-text-muted">Applies to this form&rsquo;s canvas and its public page.</p>
        <div className="flex flex-col gap-4">
          <ThemeGallery onSelect={setTheme} />
          
          <div className="my-4 h-px bg-border" />
          
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
          <BackgroundImageField value={theme.background_image} onChange={(url) => setTheme({ background_image: url })} />
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
    </div>
  );
}

function ThemeGallery({ onSelect }: { onSelect: (t: Theme) => void }) {
  const [themes, setThemes] = useState<{id: number, name: string, theme: Theme}[]>([]);
  
  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + "/themes")
      .then(r => r.json())
      .then(setThemes)
      .catch(console.error);
  }, []);

  if (!themes.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Gallery</label>
      <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[200px] p-1">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.theme)}
            className="group flex flex-col items-center gap-1 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
            title={t.name}
          >
            <div
              className="w-full aspect-[4/3] rounded border shadow-sm ring-1 ring-inset ring-black/5"
              style={themeStyle(t.theme)}
            >
              <div className="flex h-full flex-col p-2 gap-1.5 opacity-90">
                <div className="h-1.5 w-3/4 rounded-full bg-[var(--resp-text)]" />
                <div className="h-1.5 w-1/2 rounded-full bg-[var(--resp-text)]" />
                <div className="mt-auto h-2.5 w-full rounded bg-[var(--resp-accent)]" />
              </div>
            </div>
            <span className="text-[10px] text-text-muted truncate w-full text-center">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BackgroundImageField({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/media/sign", { method: "POST" });
      if (!res.ok) throw new Error("Could not sign upload");
      const signatureData = await res.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signatureData.api_key);
      formData.append("timestamp", signatureData.timestamp);
      formData.append("signature", signatureData.signature);
      formData.append("folder", signatureData.folder);

      const uploadRes = await fetch(signatureData.upload_url, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();

      onChange(uploadData.secure_url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload image. Check console for details.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [onChange]);

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <label className="text-sm font-semibold">Background image</label>
      {value ? (
        <div className="flex items-center gap-3">
          <div
            className="size-10 shrink-0 rounded-md bg-cover bg-center ring-1 ring-border"
            style={{ backgroundImage: `url(${value})` }}
          />
          <div className="flex-1 truncate text-xs text-text-muted">Image applied</div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} aria-label="Remove image">
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full gap-2 font-normal"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon className="size-4" />
            {uploading ? "Uploading..." : "Add background image"}
          </Button>
          <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={handleFileChange} />
        </div>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const id = useId();
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

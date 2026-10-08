"use client";

import { useState } from "react";
import { Input, Textarea } from "@/components/ui";
import type { ThankYou } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { PanelCard } from "../panel/PanelCard";

// Mirrors backend limits (schemas/form.py ThankYou).
const TITLE_MAX = 200;
const MESSAGE_MAX = 1000;
const BUTTON_TEXT_MAX = 50;
const URL_MAX = 2000;
const HTTP_URL = /^https?:\/\/\S+$/;

/** The ending (thank-you screen) panel. The canvas shows the result live. */
export function ThankYouSettings() {
  const thankYou = useBuilderStore((s) => s.form!.thank_you);
  const updateForm = useBuilderStore((s) => s.updateForm);
  // The URL is kept locally until valid, so a half-typed link is never sent (the server would reject it).
  const [url, setUrl] = useState(thankYou.button_url ?? "");
  const urlError = url && !HTTP_URL.test(url) ? "Links must start with http:// or https://" : undefined;

  const save = (patch: Partial<ThankYou>) => updateForm({ thank_you: { ...thankYou, ...patch } });

  return (
    <PanelCard title="Ending">
      <p className="mb-4 text-xs text-text-muted">Shown after someone submits the form.</p>
      <div className="flex flex-col gap-4">
        <Input
          label="Title"
          value={thankYou.title}
          maxLength={TITLE_MAX}
          onChange={(e) => save({ title: e.target.value })}
        />
        <Textarea
          label="Message"
          rows={3}
          value={thankYou.message}
          maxLength={MESSAGE_MAX}
          onChange={(e) => save({ message: e.target.value })}
        />
        <Input
          label="Button text"
          placeholder="e.g. Visit our website"
          hint="Optional. Shown only when a link is set too."
          value={thankYou.button_text ?? ""}
          maxLength={BUTTON_TEXT_MAX}
          onChange={(e) => save({ button_text: e.target.value || null })}
        />
        <Input
          label="Button link"
          type="url"
          placeholder="https://example.com"
          value={url}
          maxLength={URL_MAX}
          error={urlError}
          onChange={(e) => {
            const next = e.target.value.trim();
            setUrl(next);
            if (!next) save({ button_url: null });
            else if (HTTP_URL.test(next)) save({ button_url: next });
          }}
        />
      </div>
    </PanelCard>
  );
}

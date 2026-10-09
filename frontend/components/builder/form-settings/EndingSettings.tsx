import { useBuilderStore } from "@/store/builderStore";
import { Input, Textarea } from "@/components/ui";
import { MediaSettings } from "../settings/MediaSettings";

export function EndingSettings() {
  const form = useBuilderStore((s) => s.form);
  const selectedEndingId = useBuilderStore((s) => s.selectedEndingId);
  const updateEnding = useBuilderStore((s) => s.updateEnding);

  const ending = form?.endings?.find((e) => e.id === selectedEndingId);

  if (!ending) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Ending Screen</h3>
        <p className="text-xs text-text-subtle">Customize what respondents see when they finish.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-subtle">Title</label>
        <Input
          value={ending.title}
          onChange={(e) => updateEnding(ending.id, { title: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-subtle">Message</label>
        <Textarea
          value={ending.message}
          onChange={(e) => updateEnding(ending.id, { message: e.target.value })}
          rows={4}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-subtle">Button text (Optional)</label>
        <Input
          value={ending.button_text || ""}
          onChange={(e) => updateEnding(ending.id, { button_text: e.target.value || null })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-subtle">Button URL (Optional)</label>
        <Input
          type="url"
          value={ending.button_url || ""}
          onChange={(e) => updateEnding(ending.id, { button_url: e.target.value || null })}
          placeholder="https://"
        />
      </div>
      <MediaSettings media={ending} onChange={(patch) => updateEnding(ending.id, patch)} />
    </div>
  );
}

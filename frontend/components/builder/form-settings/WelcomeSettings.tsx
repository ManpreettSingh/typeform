import { useBuilderStore } from "@/store/builderStore";
import { Toggle, Input } from "@/components/ui";
import { MediaSettings } from "../settings/MediaSettings";

export function WelcomeSettings() {
  const form = useBuilderStore((s) => s.form);
  const updateForm = useBuilderStore((s) => s.updateForm);

  if (!form || !form.welcome) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Welcome Screen</h3>
        <p className="text-xs text-text-subtle">Customize the first screen your respondents see.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-subtle">Button text</label>
        <div className="relative">
          <Input
            value={form.welcome.button_text || ""}
            onChange={(e) => updateForm({ welcome: { ...form.welcome!, button_text: e.target.value.slice(0, 24) } })}
            maxLength={24}
            className="w-full"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
            {(form.welcome.button_text || "").length}/24
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm">Time to complete</label>
        <Toggle
          checked={form.welcome.show_time_to_complete || false}
          onChange={(c: boolean) => updateForm({ welcome: { ...form.welcome!, show_time_to_complete: c } })}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm">Submission count</label>
        <Toggle
          checked={form.welcome.show_submission_count || false}
          onChange={(c: boolean) => updateForm({ welcome: { ...form.welcome!, show_submission_count: c } })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-subtle">Image or video</label>
        <MediaSettings
          attachment={form.welcome.attachment}
          layout={form.welcome.layout}
          onChange={(patch) => updateForm({ welcome: { ...form.welcome!, ...patch } })}
        />
      </div>
    </div>
  );
}

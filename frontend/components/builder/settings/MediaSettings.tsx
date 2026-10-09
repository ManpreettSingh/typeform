import { ImageIcon, LayoutPanelLeft, LayoutPanelTop, Monitor, Maximize } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { MediaAttachment, MediaLayout } from "@/lib/types";

type Props = {
  attachment: MediaAttachment | null | undefined;
  layout: MediaLayout | null | undefined;
  onChange: (patch: { attachment?: MediaAttachment | null; layout?: MediaLayout | null }) => void;
};

export function MediaSettings({ attachment, layout, onChange }: Props) {
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

      onChange({
        attachment: {
          type: "image",
          public_id: uploadData.public_id,
          url: uploadData.secure_url,
          alt: file.name,
        },
        layout: layout || { type: "stack", placement: null },
      });
    } catch (err) {
      console.error(err);
      alert("Failed to upload image. Check console for details.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [layout, onChange]);

  const removeMedia = useCallback(() => {
    onChange({ attachment: null, layout: null });
  }, [onChange]);

  const setLayout = useCallback((type: "stack" | "split" | "float" | "wallpaper", placement: "left" | "right" | null = null) => {
    onChange({ layout: { type, placement } });
  }, [onChange]);

  const currentType = layout?.type || "stack";

  return (
    <div className="flex flex-col gap-4">
      {attachment ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              className="size-10 shrink-0 rounded-md bg-cover bg-center ring-1 ring-border"
              style={{ backgroundImage: `url(${attachment.url})` }}
            />
            <div className="flex-1 truncate text-sm">{attachment.alt || attachment.public_id}</div>
            <Button variant="ghost" size="sm" onClick={removeMedia} aria-label="Remove image">
              Remove
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Layout</label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant={currentType === "stack" ? "secondary" : "ghost"}
                className="h-10 px-0"
                onClick={() => setLayout("stack")}
                aria-label="Stack"
                title="Stack"
              >
                <LayoutPanelTop className="size-4" />
              </Button>
              <Button
                variant={currentType === "split" ? "secondary" : "ghost"}
                className="h-10 px-0"
                onClick={() => setLayout("split", "left")}
                aria-label="Split"
                title="Split"
              >
                <LayoutPanelLeft className="size-4" />
              </Button>
              <Button
                variant={currentType === "float" ? "secondary" : "ghost"}
                className="h-10 px-0"
                onClick={() => setLayout("float", "left")}
                aria-label="Float"
                title="Float"
              >
                <Monitor className="size-4" />
              </Button>
              <Button
                variant={currentType === "wallpaper" ? "secondary" : "ghost"}
                className="h-10 px-0"
                onClick={() => setLayout("wallpaper")}
                aria-label="Wallpaper"
                title="Wallpaper"
              >
                <Maximize className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            className="w-full gap-2 font-normal"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon className="size-4" />
            {uploading ? "Uploading..." : "Add image or video"}
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={inputRef}
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}

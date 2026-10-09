"use client";

import { clsx } from "clsx";
import { Check, ChevronDown, ImageUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { toast } from "sonner";
import { Button, IconButton, Menu, Textarea } from "@/components/ui";
import { imageFilter, imagePosition, layoutFor, type ResolvedLayout } from "@/lib/media";
import type { MediaAttachment, MediaLayout, MediaProperties } from "@/lib/types";
import { uploadImage } from "@/lib/upload";
import { PanelDivider } from "../panel/PanelCard";

const ALT_MAX = 125;

type Choice = ResolvedLayout & { label: string };

const DESKTOP_LAYOUTS: Choice[] = [
  { type: "stack", placement: "left", label: "Stack" },
  { type: "float", placement: "right", label: "Float right" },
  { type: "float", placement: "left", label: "Float left" },
  { type: "split", placement: "right", label: "Split right" },
  { type: "split", placement: "left", label: "Split left" },
  { type: "wallpaper", placement: "left", label: "Wallpaper" },
];

const MOBILE_LAYOUTS: Choice[] = [
  { type: "stack", placement: "left", label: "Stack" },
  { type: "float", placement: "left", label: "Float" },
  { type: "split", placement: "left", label: "Split" },
  { type: "wallpaper", placement: "left", label: "Wallpaper" },
];

/** Stored placement only matters for float and split. */
const toLayout = ({ type, placement }: ResolvedLayout): MediaLayout => ({
  type,
  placement: type === "float" || type === "split" ? placement : null,
});

/**
 * Typeform's "Image or video" settings: add / change / remove, a layout for mobile and one for desktop, focal point,
 * brightness and alt text. Used for questions, the welcome screen and endings.
 */
export function MediaSettings({
  media,
  onChange,
}: {
  media: MediaProperties;
  onChange: (patch: MediaProperties) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { attachment } = media;

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setUploading(true);
      try {
        const { url, public_id } = await uploadImage(file);
        // A new image starts centred at normal brightness; layouts are kept when it's a replacement.
        onChange({
          attachment: { type: "image", public_id, url, alt: "" },
          layout: media.layout ?? { type: "stack", placement: null },
        });
      } catch (err) {
        console.error(err);
        toast.error("Couldn't upload the image.");
      } finally {
        setUploading(false);
      }
    },
    [media.layout, onChange],
  );

  const patchAttachment = (patch: Partial<MediaAttachment>) => attachment && onChange({ attachment: { ...attachment, ...patch } });

  return (
    <div className="flex flex-col">
      <div className="flex min-h-10 items-center justify-between gap-2 text-sm text-text-muted">
        <span>Image or video</span>
        {uploading ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-label="Uploading" />
        ) : attachment ? (
          <div className="flex items-center">
            <IconButton size="sm" label="Change image" icon={<ImageUp className="size-4" />} onClick={() => inputRef.current?.click()} />
            <IconButton
              size="sm"
              label="Remove image"
              icon={<Trash2 className="size-4" />}
              onClick={() => onChange({ attachment: null, layout: null, viewport_overrides: null })}
            />
          </div>
        ) : (
          <IconButton size="sm" label="Add image" icon={<Plus className="size-4" />} onClick={() => inputRef.current?.click()} />
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleFile} />
      </div>

      {attachment && (
        <>
          <PanelDivider />
          <p className="pt-1 text-sm font-semibold text-text">Layout</p>
          <LayoutPicker
            label="Mobile"
            choices={MOBILE_LAYOUTS}
            value={layoutFor(media, true)}
            onChange={(next) => onChange({ viewport_overrides: { ...media.viewport_overrides, small: toLayout(next) } })}
          />
          <LayoutPicker
            label="Desktop"
            choices={DESKTOP_LAYOUTS}
            sided
            value={layoutFor(media, false)}
            onChange={(next) => onChange({ layout: toLayout(next) })}
          />

          <PanelDivider />
          <FocalPoint attachment={attachment} onChange={(focal_point) => patchAttachment({ focal_point })} />

          <PanelDivider />
          <Brightness value={attachment.brightness ?? 0} onChange={(brightness) => patchAttachment({ brightness })} />

          <PanelDivider />
          <AltText value={attachment.alt} onChange={(alt) => patchAttachment({ alt })} />
        </>
      )}
    </div>
  );
}

function LayoutPicker({
  label,
  choices,
  sided = false,
  value,
  onChange,
}: {
  label: string;
  choices: Choice[];
  sided?: boolean;
  value: ResolvedLayout;
  onChange: (layout: ResolvedLayout) => void;
}) {
  // Desktop float and split come in left and right; mobile ones have no side.
  const current =
    choices.find((c) => c.type === value.type && (!sided || c.placement === value.placement)) ?? choices[0];
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 text-sm text-text-muted">
      <span>{label}</span>
      <Menu
        align="end"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label={`${label} layout: ${current.label}`}
            className="flex h-8 items-center gap-1.5 rounded-input border border-border-strong bg-field px-2 text-text hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <LayoutIcon layout={current} />
            <ChevronDown className="size-3.5 text-text-muted" aria-hidden />
          </button>
        )}
        items={choices.map((choice) => ({
          label: choice.label,
          icon: <LayoutIcon layout={choice} />,
          hint: choice === current ? <Check className="size-4 text-text-muted" aria-hidden /> : undefined,
          onSelect: () => onChange(choice),
        }))}
      />
    </div>
  );
}

/** Small thumbnail of a layout: the frame, the image (filled) and the question (lines). */
function LayoutIcon({ layout }: { layout: ResolvedLayout }) {
  const left = layout.placement === "left";
  const lines = (x: number, w: number) => (
    <>
      <rect x={x} y={5} width={w} height={1.5} rx={0.75} />
      <rect x={x} y={8.5} width={w * 0.7} height={1.5} rx={0.75} />
    </>
  );
  return (
    <svg viewBox="0 0 22 15" className="h-[15px] w-[22px] shrink-0" aria-hidden>
      <rect x={0.5} y={0.5} width={21} height={14} rx={2} fill="none" stroke="currentColor" opacity={0.5} />
      <g fill="currentColor">
        {layout.type === "stack" && (
          <>
            <rect x={6} y={2.5} width={10} height={6} rx={0.5} />
            <rect x={6} y={10} width={10} height={1.5} rx={0.75} opacity={0.6} />
          </>
        )}
        {layout.type === "float" && (
          <>
            <rect x={left ? 3 : 12.5} y={4} width={6.5} height={7} rx={0.5} />
            <g opacity={0.6}>{lines(left ? 12 : 3, 7)}</g>
          </>
        )}
        {layout.type === "split" && (
          <>
            <rect x={left ? 1 : 11} y={1} width={10} height={13} rx={1.5} />
            <g opacity={0.6}>{lines(left ? 13 : 3, 6.5)}</g>
          </>
        )}
        {layout.type === "wallpaper" && (
          <>
            <rect x={1} y={1} width={20} height={13} rx={1.5} opacity={0.35} />
            {lines(6, 10)}
          </>
        )}
      </g>
    </svg>
  );
}

/** Drag the point (or use the arrow keys) to choose what stays in view when a layout crops the image. */
function FocalPoint({
  attachment,
  onChange,
}: {
  attachment: MediaAttachment;
  onChange: (focal: { x: number; y: number } | null) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const x = attachment.focal_point?.x ?? 0.5;
  const y = attachment.focal_point?.y ?? 0.5;
  const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;

  const moveTo = (e: PointerEvent) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (rect) onChange({ x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    onChange({ x: clamp(x + move[0]), y: clamp(y + move[1]) });
  };

  return (
    <div className="flex flex-col gap-2 py-1">
      <p className="text-sm font-semibold text-text">Focal point</p>
      <div
        ref={areaRef}
        role="slider"
        tabIndex={0}
        aria-label="Focal point"
        aria-roledescription="2D slider"
        aria-valuenow={Math.round(x * 100)}
        aria-valuetext={`${Math.round(x * 100)}% across, ${Math.round(y * 100)}% down`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e);
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && moveTo(e)}
        onKeyDown={onKeyDown}
        className="relative cursor-crosshair touch-none overflow-hidden rounded-input bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user upload thumbnail */}
        <img src={attachment.url} alt="" draggable={false} className="block max-h-40 w-full object-contain" style={{ filter: imageFilter(attachment.brightness) }} />
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="self-end"
        disabled={imagePosition(attachment.focal_point) === "50% 50%"}
        onClick={() => onChange(null)}
      >
        Reset
      </Button>
    </div>
  );
}

function Brightness({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    setDraft(null);
    const n = Math.round(Number(raw));
    if (raw.trim() !== "" && Number.isFinite(n)) onChange(Math.min(100, Math.max(-100, n)));
  };
  return (
    <div className="flex flex-col gap-2 py-1">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        Brightness
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={-100}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-text"
        />
        <input
          type="number"
          aria-label="Brightness value"
          min={-100}
          max={100}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
          className={clsx(
            "h-8 w-16 rounded-input border border-border-strong bg-field px-2 text-sm text-text",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          )}
        />
      </div>
    </div>
  );
}

function AltText({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 py-1">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        Alt text
      </label>
      <Textarea
        id={id}
        rows={2}
        maxLength={ALT_MAX}
        placeholder="Describe the image for people using screen readers"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-right text-xs text-text-muted">
        {value.length}/{ALT_MAX}
      </p>
    </div>
  );
}

import type { MediaAttachment, MediaLayoutType, MediaProperties } from "./types";

export type ResolvedLayout = { type: MediaLayoutType; placement: "left" | "right" };

/** The layout for this screen size: `layout` on desktop, `viewport_overrides.small` on mobile (stack when unset). */
export function layoutFor(media: MediaProperties, small: boolean): ResolvedLayout {
  const layout = small ? media.viewport_overrides?.small : media.layout;
  return { type: layout?.type ?? "stack", placement: layout?.placement ?? "left" };
}

/** Typeform's brightness: below 0 only darkens; above 0 brightens and flattens contrast so it fades towards white. */
export function imageFilter(brightness: number | null | undefined): string | undefined {
  if (!brightness) return undefined;
  const b = brightness / 100;
  return b > 0 ? `contrast(${1 - b}) brightness(${1 + b})` : `brightness(${1 + b})`;
}

/** The focal point as an `object-position`, so cropped layouts keep it in view. */
export function imagePosition(focal: MediaAttachment["focal_point"]): string {
  const x = focal?.x ?? 0.5;
  const y = focal?.y ?? 0.5;
  return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
}

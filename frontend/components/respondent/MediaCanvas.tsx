import { clsx } from "clsx";
import { createContext, useContext, type ReactNode } from "react";
import { imageFilter, imagePosition, layoutFor } from "@/lib/media";
import type { MediaAttachment, MediaProperties } from "@/lib/types";

type Props = MediaProperties & {
  /** Mobile-sized screen: use the mobile layout (`viewport_overrides.small`). */
  small: boolean;
  /**
   * Questions show a stacked image between their text and the answer, like Typeform (QuestionShell places it via
   * `useStackedMedia`). Welcome and ending screens get it above everything instead.
   */
  inlineStack?: boolean;
  children: ReactNode;
};

const StackedMedia = createContext<ReactNode>(null);

/** The stacked image for the question being rendered, if its layout is stack. */
export const useStackedMedia = () => useContext(StackedMedia);

/**
 * A screen with its image, laid out like Typeform (measured on its 1024×575 desktop and 425×756 mobile slides):
 * stack (image under the text), float (image beside or above, uncropped), split (image fills one half, or a 16:9
 * band on top on mobile) and wallpaper (image behind everything, no card).
 */
export function MediaCanvas({ attachment, layout, viewport_overrides, small, inlineStack = false, children }: Props) {
  const pad = small ? "px-6 py-10" : "px-10 py-14";
  const column = (content: ReactNode, className?: string, top = false) => (
    <div className={clsx("flex min-w-0 flex-col items-center", top ? "justify-start" : "justify-center", pad, className)}>
      {content}
    </div>
  );
  if (!attachment) {
    return <div className="mx-auto flex w-full flex-col items-center justify-center px-6 py-16 sm:px-10">{children}</div>;
  }

  const { type, placement } = layoutFor({ layout, viewport_overrides }, small);
  const imageRight = placement === "right";

  if (type === "wallpaper") {
    return (
      <div className="relative flex w-full flex-1">
        <Picture attachment={attachment} className="absolute inset-0 size-full object-cover" />
        {column(children, "relative w-full flex-1")}
      </div>
    );
  }

  if (type === "split") {
    if (small) {
      return (
        <div className="flex w-full flex-1 flex-col">
          <Picture attachment={attachment} className="aspect-video w-full shrink-0 object-cover" />
          {/* Typeform starts the question right under the band. */}
          {column(children, "flex-1", true)}
        </div>
      );
    }
    return (
      <div className="grid w-full flex-1 grid-cols-2">
        <div className={clsx("relative min-h-full", imageRight && "order-last")}>
          <Picture attachment={attachment} className="absolute inset-0 size-full object-cover" />
        </div>
        {column(children)}
      </div>
    );
  }

  if (type === "float") {
    if (small) {
      return column(
        <>
          <Picture attachment={attachment} className="mb-8 max-h-[40vh] w-full object-contain" />
          {children}
        </>,
        "w-full flex-1",
      );
    }
    return (
      <div className="grid w-full flex-1 grid-cols-2">
        <div className={clsx("flex min-w-0 items-center justify-center", pad, imageRight && "order-last")}>
          <Picture attachment={attachment} className="max-h-full max-w-full object-contain" />
        </div>
        {column(children)}
      </div>
    );
  }

  // stack
  if (inlineStack) {
    return (
      <StackedMedia.Provider
        value={<Picture attachment={attachment} className="max-h-[40vh] max-w-full object-contain" />}
      >
        {column(children, "w-full flex-1")}
      </StackedMedia.Provider>
    );
  }
  return column(
    <>
      <Picture attachment={attachment} className="mb-8 max-h-[40vh] max-w-full object-contain" />
      {children}
    </>,
    "w-full flex-1",
  );
}

function Picture({ attachment, className }: { attachment: MediaAttachment; className: string }) {
  const style = { filter: imageFilter(attachment.brightness), objectPosition: imagePosition(attachment.focal_point) };
  if (attachment.type === "video") {
    // Decorative, like Typeform's background videos: muted, looping, no controls.
    return (
      <video
        src={attachment.url}
        aria-label={attachment.alt || undefined}
        aria-hidden={attachment.alt ? undefined : true}
        className={className}
        style={style}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user uploads from any host; next/image needs known sizes
    <img
      src={attachment.url}
      alt={attachment.alt}
      className={className}
      style={style}
    />
  );
}

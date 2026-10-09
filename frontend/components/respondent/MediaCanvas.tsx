import { clsx } from "clsx";
import type { MediaAttachment, MediaLayout } from "@/lib/types";

type Props = {
  attachment?: MediaAttachment | null;
  layout?: MediaLayout | null;
  children: React.ReactNode;
};

export function MediaCanvas({ attachment, layout, children }: Props) {
  if (!attachment) {
    return (
      <div className="flex w-full flex-col items-center justify-center mx-auto px-6 sm:px-10 py-16">
        {children}
      </div>
    );
  }

  const lType = layout?.type || "stack";
  const placement = layout?.placement || "left";

  if (lType === "wallpaper") {
    return (
      <div className="relative flex min-h-full w-full items-center justify-center p-6 sm:p-10 py-16">
        <div 
          className="absolute inset-0 bg-cover bg-center -z-10"
          style={{ backgroundImage: `url(${attachment.url})`, filter: attachment.brightness ? `brightness(${attachment.brightness}%)` : undefined }}
        />
        <div className="flex w-full max-w-2xl flex-col rounded-xl bg-resp-bg/90 p-8 shadow-2xl backdrop-blur-sm sm:p-12">
          {children}
        </div>
      </div>
    );
  }

  if (lType === "split") {
    return (
      <div className={clsx("flex min-h-[100dvh] w-full flex-col", placement === "right" ? "md:flex-row" : "md:flex-row-reverse")}>
        <div className="flex flex-1 items-center justify-center p-6 sm:p-12 py-16">
          <div className="w-full">{children}</div>
        </div>
        <div 
          className="min-h-[40vh] w-full flex-1 bg-cover bg-center md:min-h-full"
          style={{ backgroundImage: `url(${attachment.url})` }}
        />
      </div>
    );
  }

  if (lType === "float") {
    return (
      <div className={clsx("flex min-h-[100dvh] w-full max-w-6xl mx-auto flex-col items-center justify-center gap-8 px-6 sm:px-10 py-16 md:gap-16", placement === "right" ? "md:flex-row" : "md:flex-row-reverse")}>
        <div className="flex-1 w-full max-w-2xl">{children}</div>
        <img src={attachment.url} alt={attachment.alt} className="max-h-[60vh] w-full max-w-md flex-1 rounded-xl object-contain shadow-sm" />
      </div>
    );
  }

  // stack
  return (
    <div className="flex w-full max-w-2xl mx-auto flex-col items-center justify-center gap-8 px-6 sm:px-10 py-16">
      <img src={attachment.url} alt={attachment.alt} className="max-h-[50vh] w-full rounded-xl object-contain" />
      <div className="w-full">{children}</div>
    </div>
  );
}

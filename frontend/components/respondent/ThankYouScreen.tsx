import { ExternalLink } from "lucide-react";
import type { ThankYou } from "@/lib/types";

/** End screen. `interactive=false` renders the button as plain text (builder previews). */
export function ThankYouScreen({ thankYou, interactive = true }: { thankYou: ThankYou; interactive?: boolean }) {
  const { title, message, button_text, button_url } = thankYou;
  const buttonClass =
    "inline-flex items-center gap-1.5 rounded-resp-button bg-resp-accent px-5 py-2.5 text-lg font-semibold text-resp-accent-fg";

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 text-center">
      <h2 className="text-2xl leading-snug break-words sm:text-3xl">{title || "Thank you!"}</h2>
      {message && <p className="text-lg break-words whitespace-pre-line opacity-70">{message}</p>}
      {button_text && button_url && (
        <div className="mt-4">
          {interactive ? (
            <a
              href={button_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass} transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent`}
            >
              {button_text}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : (
            <span className={buttonClass}>{button_text}</span>
          )}
        </div>
      )}
    </div>
  );
}

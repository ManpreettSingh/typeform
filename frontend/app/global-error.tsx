"use client";

import "./globals.css";
import { COLOR_SCHEME_SCRIPT } from "@/lib/colorSchemeScript";

/** Last-resort boundary for errors in the root layout itself. Replaces the whole document. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh items-center justify-center bg-bg p-6 font-sans text-text">
        <title>Something went wrong · Forms</title>
        <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-text-muted">The app couldn&rsquo;t load. Your saved work is safe.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-2 h-10 rounded-input bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

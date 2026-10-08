import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreateFormButton } from "./CreateFormButton";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg px-4 sm:px-6">
      <Link
        href="/forms"
        className="flex items-center gap-2 rounded-input font-semibold text-text focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="flex size-7 items-center justify-center rounded-input bg-primary text-primary-fg">
          <MessageSquareText className="size-4" aria-hidden />
        </span>
        Forms
      </Link>
      <div className="flex items-center gap-3">
        <CreateFormButton size="sm" />
        <ThemeToggle />
        {/* No auth: everything belongs to a single default creator. */}
        <span
          title="Default creator"
          className="flex size-8 items-center justify-center rounded-pill bg-bg-subtle text-xs font-semibold text-text-muted"
        >
          DC
        </span>
      </div>
    </header>
  );
}

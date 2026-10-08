import { ChevronDown, CircleHelp, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TypeformPill } from "@/components/TypeformLogo";
import { Badge, IconButton } from "@/components/ui";

/** Workspace top bar, like Typeform's: logo pill + account square on the left, utilities on the right. */
export function TopNav() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-bg pr-3 pl-2.5 sm:pr-4">
      <Link
        href="/forms"
        className="flex items-center gap-2 rounded-input py-1 pr-2 text-sm font-medium text-text-soft focus-visible:outline-2 focus-visible:outline-accent"
      >
        {/* Typeform's mark is a pill + a square; here the account avatar is the square, as in the original. */}
        <TypeformPill />
        <span className="flex size-8 items-center justify-center rounded-field bg-account text-[15px] text-account-fg">D</span>
        <span className="hidden sm:inline">Default creator</span>
        <ChevronDown className="size-4 text-text-muted" aria-hidden />
        <span className="sr-only">Typeform clone home</span>
      </Link>

      <div className="flex items-center gap-1 sm:gap-2">
        <span
          aria-disabled="true"
          title="Coming soon"
          className="hidden items-center gap-1.5 rounded-input px-2 py-1.5 text-sm text-text-muted sm:inline-flex"
        >
          <LayoutGrid className="size-4" aria-hidden />
          Integrations <Badge variant="accent">Soon</Badge>
        </span>
        <ThemeToggle />
        <IconButton label="Help (coming soon)" icon={<CircleHelp className="size-4" />} disabled />
        {/* No auth: everything belongs to a single default creator. */}
        <span
          title="Default creator"
          className="flex size-8 items-center justify-center rounded-pill bg-thumb-4 text-xs font-semibold text-thumb-fg"
        >
          DC
        </span>
      </div>
    </header>
  );
}

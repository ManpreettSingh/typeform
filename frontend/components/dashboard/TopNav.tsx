import { CircleHelp, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TypeformPill } from "@/components/TypeformLogo";
import { Badge, IconButton } from "@/components/ui";
import { AccountInitialsBadge, AccountMenu } from "./AccountMenu";

/** Workspace top bar, like Typeform's: logo pill + account square on the left, utilities on the right. */
export function TopNav() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-bg pr-3 pl-2.5 sm:pr-4">
      <div className="flex items-center gap-1">
        <Link
          href="/forms"
          className="flex items-center rounded-input py-1 pr-1 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {/* Typeform's mark is a pill + a square; here the account avatar (next to it) is the square, as in the original. */}
          <TypeformPill />
          <span className="sr-only">Typeform clone home</span>
        </Link>
        <AccountMenu />
      </div>

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
        {/* No accounts: the name comes from the visitor's onboarding answers (localStorage), else "Default creator". */}
        <AccountInitialsBadge />
      </div>
    </header>
  );
}

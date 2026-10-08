import { clsx } from "clsx";
import { ChartLine, PanelsTopLeft, Users, Workflow, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui";

const SECTIONS: { label: string; icon: LucideIcon; href?: string }[] = [
  { label: "Forms", icon: PanelsTopLeft, href: "/forms" },
  { label: "Contacts", icon: Users },
  { label: "Automations", icon: Workflow },
  { label: "Insights", icon: ChartLine },
];

/** Typeform's workspace sections. Only Forms exists here; the rest are "Soon" placeholders. */
export function SectionTabs() {
  return (
    <nav aria-label="Sections" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3 pt-2.5">
      {SECTIONS.map(({ label, icon: Icon, href }) => {
        const content = (
          <>
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
            {!href && <Badge variant="accent">Soon</Badge>}
          </>
        );
        const base = "relative mb-1 inline-flex shrink-0 items-center gap-2 rounded-input px-2.5 py-1.5 text-sm font-medium";
        return href ? (
          <Link
            key={label}
            href={href}
            aria-current="page"
            className={clsx(
              base,
              "bg-bg-hover text-text-soft focus-visible:outline-2 focus-visible:outline-accent",
              // Typeform marks the active section with a pill plus an underline on the divider.
              "after:absolute after:inset-x-2 after:-bottom-[5px] after:h-0.5 after:rounded-pill after:bg-primary",
            )}
          >
            {content}
          </Link>
        ) : (
          <span key={label} aria-disabled="true" title="Coming soon" className={clsx(base, "cursor-default text-text-muted")}>
            {content}
          </span>
        );
      })}
    </nav>
  );
}

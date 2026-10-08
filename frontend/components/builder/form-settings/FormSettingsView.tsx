"use client";

import { clsx } from "clsx";
import { GitBranch, Palette, PartyPopper, Plug, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { ComingSoonSection } from "./ComingSoonSection";
import { ThankYouSettings } from "./ThankYouSettings";
import { ThemeSettings } from "./ThemeSettings";

type SectionId = "theme" | "thank-you" | "logic" | "integrations" | "collaborate";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; comingSoon?: boolean }[] = [
  { id: "theme", label: "Theme", icon: Palette },
  { id: "thank-you", label: "Thank-you screen", icon: PartyPopper },
  { id: "logic", label: "Logic", icon: GitBranch, comingSoon: true },
  { id: "integrations", label: "Integrations", icon: Plug, comingSoon: true },
  { id: "collaborate", label: "Collaborate", icon: Users, comingSoon: true },
];

const COMING_SOON: Record<"logic" | "integrations" | "collaborate", { title: string; description: string }> = {
  logic: {
    title: "Logic jumps",
    description: "Send respondents to different questions based on their answers.",
  },
  integrations: {
    title: "Integrations",
    description: "Send responses to Google Sheets, Slack, webhooks and more.",
  },
  collaborate: {
    title: "Collaborate",
    description: "Invite teammates to build and review forms with you.",
  },
};

export function FormSettingsView() {
  const [section, setSection] = useState<SectionId>("theme");

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav
        aria-label="Settings sections"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 md:w-60 md:flex-col md:border-r md:border-b-0 md:p-3"
      >
        {SECTIONS.map(({ id, label, icon: Icon, comingSoon }) => (
          <button
            key={id}
            type="button"
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 rounded-input px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-accent",
              section === id ? "bg-bg-hover font-medium text-text" : "text-text-muted hover:bg-bg-subtle hover:text-text",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {comingSoon && <Badge variant="accent">Soon</Badge>}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === "theme" && <ThemeSettings />}
        {section === "thank-you" && <ThankYouSettings />}
        {(section === "logic" || section === "integrations" || section === "collaborate") && (
          <ComingSoonSection {...COMING_SOON[section]} />
        )}
      </div>
    </div>
  );
}

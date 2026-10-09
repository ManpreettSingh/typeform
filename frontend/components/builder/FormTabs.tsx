"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export type FormTab = "content" | "workflow" | "connect" | "share" | "results";

const TABS: { value: FormTab; label: string }[] = [
  { value: "content", label: "Content" },
  { value: "workflow", label: "Workflow" },
  { value: "connect", label: "Connect" },
  { value: "share", label: "Share" },
  { value: "results", label: "Results" },
];

export function FormTabs({ active, formId, onViewChange }: { active: FormTab, formId: number, onViewChange?: (v: "content"|"workflow"|"connect") => void }) {
  const router = useRouter();

  function onTab(tab: FormTab) {
    if (tab === "share") router.push(`/forms/${formId}/share`);
    else if (tab === "results") router.push(`/forms/${formId}/results`);
    else if (tab === "content" || tab === "workflow" || tab === "connect") {
      if (onViewChange) onViewChange(tab);
      // Say which view: the builder page may come back from the background still showing another one.
      else router.push(`/forms/${formId}/edit${tab === "content" ? "" : `?view=${tab}`}`);
    }
  }

  return (
    <div role="tablist" aria-label="Form sections" className="hidden h-full items-stretch gap-7 md:flex">
      {TABS.map(({ value, label }) => {
        const selected = value === active;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onTab(value)}
            className={clsx(
              "relative px-0.5 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent transition-colors duration-200",
              selected ? "text-text" : "text-text-soft hover:text-text",
            )}
          >
            {label}
            {selected && (
              <motion.div
                layoutId="formTopBarTab"
                className="absolute inset-x-0 top-0 h-[3px] rounded-b-[3px] bg-text-soft"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

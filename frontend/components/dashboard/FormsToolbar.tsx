"use client";

import { clsx } from "clsx";
import { Calendar, Check, ChevronDown, LayoutGrid, List } from "lucide-react";
import { Button, Menu } from "@/components/ui";
import type { FormListItem } from "@/lib/types";
import type { WorkspaceView } from "./useWorkspaceView";

export type SortKey = "created" | "updated" | "title";

const SORT_LABELS: Record<SortKey, string> = {
  created: "Date created",
  updated: "Last updated",
  title: "Alphabetical",
};

export function sortForms(forms: FormListItem[], key: SortKey): FormListItem[] {
  const sorted = [...forms];
  if (key === "title") return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  const field = key === "updated" ? "updated_at" : "created_at";
  // ISO-8601 UTC strings sort chronologically as plain strings.
  return sorted.sort((a, b) => b[field].localeCompare(a[field]));
}

type Props = {
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
};

/** Typeform's workspace controls: a sort dropdown and the List / Grid switch. */
export function FormsToolbar({ sort, onSortChange, view, onViewChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <Menu
        align="end"
        items={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
          label: SORT_LABELS[key],
          hint: key === sort ? <Check className="size-4 text-text" aria-label="(current)" /> : null,
          onSelect: () => onSortChange(key),
        }))}
        trigger={(props) => (
          <Button {...props} size="sm" variant="secondary" leftIcon={<Calendar className="size-4" aria-hidden />}>
            {SORT_LABELS[sort]}
            <ChevronDown className="size-4 text-text-muted" aria-hidden />
          </Button>
        )}
      />
      <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-field border border-border-strong bg-field">
        {(
          [
            ["list", "List", List],
            ["grid", "Grid", LayoutGrid],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => onViewChange(value)}
            className={clsx(
              "inline-flex h-8 items-center gap-1.5 px-2.5 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              view === value ? "bg-bg-hover text-text-soft" : "text-text-muted hover:text-text",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

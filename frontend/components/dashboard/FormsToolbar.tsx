"use client";

import { ArrowUpDown, Check, Search } from "lucide-react";
import { Button, Input, Menu } from "@/components/ui";
import type { FormListItem } from "@/lib/types";

export type SortKey = "updated" | "created" | "title";

const SORT_LABELS: Record<SortKey, string> = {
  updated: "Last updated",
  created: "Date created",
  title: "Title (A–Z)",
};

export function sortForms(forms: FormListItem[], key: SortKey): FormListItem[] {
  const sorted = [...forms];
  if (key === "title") return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  const field = key === "updated" ? "updated_at" : "created_at";
  // ISO-8601 UTC strings sort chronologically as plain strings.
  return sorted.sort((a, b) => b[field].localeCompare(a[field]));
}

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
};

export function FormsToolbar({ query, onQueryChange, sort, onSortChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="sm:w-72">
        <Input
          type="search"
          aria-label="Search forms"
          placeholder="Search forms"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          leftIcon={<Search className="size-4" />}
        />
      </div>
      <Menu
        align="end"
        items={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
          label: SORT_LABELS[key],
          icon: <Check className={key === sort ? "size-4 text-text" : "size-4 opacity-0"} aria-hidden />,
          onSelect: () => onSortChange(key),
        }))}
        trigger={(props) => (
          <Button {...props} variant="secondary" leftIcon={<ArrowUpDown className="size-4" aria-hidden />}>
            {SORT_LABELS[sort]}
          </Button>
        )}
      />
    </div>
  );
}

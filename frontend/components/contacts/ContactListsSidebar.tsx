"use client";

import { clsx } from "clsx";
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { IconButton, Menu } from "@/components/ui";
import type { ContactList } from "@/lib/queries/contacts";

type Props = {
  lists: ContactList[];
  /** Contacts in the default list (everyone), once known. */
  total: number | null;
  activeId: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
  onRename: (list: ContactList) => void;
  onDelete: (list: ContactList) => void;
};

/** Typeform's "Contact lists" column: the default list of everyone, then the lists saved from filters. */
export function ContactListsSidebar({ lists, total, activeId, onSelect, onNew, onRename, onDelete }: Props) {
  const row = (active: boolean) =>
    clsx(
      "flex h-10 w-full items-center justify-between rounded-field px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent",
      active ? "bg-bg-hover text-text" : "text-text-soft hover:bg-bg-hover/50 hover:text-text",
    );

  return (
    <aside aria-label="Contact lists" className="hidden w-64 shrink-0 flex-col gap-1.5 border-r border-border p-4 md:flex">
      <div className="flex items-center justify-between pl-3">
        <span className="flex items-center gap-2 text-sm font-medium text-text-soft">
          <Users className="size-4" aria-hidden />
          Contact lists
        </span>
        <IconButton
          size="sm"
          label="New list"
          icon={<Plus className="size-4" />}
          onClick={onNew}
          className="border border-border-strong bg-field hover:bg-bg-hover"
        />
      </div>

      <button type="button" aria-current={activeId === null ? "page" : undefined} onClick={() => onSelect(null)} className={row(activeId === null)}>
        All contacts
        {total !== null && <span className="text-xs text-text-soft">{total}</span>}
      </button>

      {lists.map((list) => {
        const active = activeId === list.id;
        return (
          <div key={list.id} className={clsx(row(active), "group gap-1 pr-1")}>
            <button type="button" aria-current={active ? "page" : undefined} onClick={() => onSelect(list.id)} className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-accent">
              <span className="truncate">{list.name}</span>
              <span className="text-xs text-text-soft">{list.count}</span>
            </button>
            <Menu
              items={[
                { label: "Rename", icon: <Pencil className="size-4 text-text-muted" />, onSelect: () => onRename(list) },
                { label: "Delete list", icon: <Trash2 className="size-4" />, danger: true, separatorBefore: true, onSelect: () => onDelete(list) },
              ]}
              trigger={(props) => <IconButton {...props} size="sm" label={`Actions for ${list.name}`} icon={<MoreHorizontal className="size-4" />} />}
            />
          </div>
        );
      })}
    </aside>
  );
}

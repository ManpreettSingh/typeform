"use client";

import { clsx } from "clsx";
import { ArrowDown, ArrowUp, Eye } from "lucide-react";
import { useRef, useState } from "react";
import { LAST_UPDATE_SOURCE_LABELS, contactLabel, sourceLabel } from "@/lib/contacts";
import { formatDateTime } from "@/lib/format";
import type { Contact } from "@/lib/queries/contacts";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";

export type EditableField = "name" | "email" | "phone" | "company";

type Column = { key: string; label: string; sort?: string; editable?: EditableField; width: string };

// Typeform's columns after the frozen Contact column. Text and email cells edit in place.
const COLUMNS: Column[] = [
  { key: "subscription_status", label: "Subscription status", sort: "subscription_status", width: "w-44" },
  { key: "name", label: "Name", sort: "name", editable: "name", width: "w-48" },
  { key: "email", label: "Email", sort: "email", editable: "email", width: "w-64" },
  { key: "phone", label: "Phone", editable: "phone", width: "w-40" },
  { key: "company", label: "Company", editable: "company", width: "w-48" },
  { key: "updated_at", label: "Last change", sort: "updated_at", width: "w-48" },
  { key: "last_update_source", label: "Last update source", sort: "last_update_source", width: "w-44" },
  { key: "sources", label: "Sources", width: "w-64" },
];

const CELL = "h-12 border-b border-border px-3 text-sm text-text align-middle";
// The checkbox and Contact columns stay put while the rest scrolls sideways; opaque so nothing shows through.
const CHECK_BODY = "sticky left-0 z-10 w-11 px-0 text-center";
const CONTACT_BODY = "sticky left-11 z-10 w-64 shadow-[1px_0_0_var(--border)]";
const CHECK_HEAD = "sticky left-0 top-0 z-30 w-11 bg-bg-subtle px-0 text-center";
const CONTACT_HEAD = "sticky left-11 top-0 z-30 w-64 bg-bg-subtle shadow-[1px_0_0_var(--border)]";

type Props = {
  contacts: Contact[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  sort: string;
  order: "asc" | "desc";
  onSort: (key: string) => void;
  onOpen: (contact: Contact) => void;
  onEdit: (contact: Contact, field: EditableField, value: string) => void;
};

export function ContactsTable({ contacts, selected, onToggle, onToggleAll, sort, order, onSort, onOpen, onEdit }: Props) {
  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someSelected = !allSelected && contacts.some((c) => selected.has(c.id));

  function header(label: string, sortKey?: string) {
    if (!sortKey) return label;
    const active = sort === sortKey;
    return (
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-mx-1 inline-flex items-center gap-1 rounded-input px-1 py-0.5 hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        {label}
        {active && (order === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)}
      </button>
    );
  }
  const ariaSort = (key?: string) => (key && sort === key ? (order === "asc" ? "ascending" : "descending") : undefined);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-max min-w-full border-separate border-spacing-0 text-left">
        <thead>
          <tr className="text-xs font-medium text-text-muted">
            <th className={clsx(CELL, CHECK_HEAD)}>
              <input
                type="checkbox"
                aria-label="Select all contacts"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={onToggleAll}
                className="size-4 accent-primary"
              />
            </th>
            <th scope="col" aria-sort={ariaSort("contact")} className={clsx(CELL, CONTACT_HEAD)}>
              {header("Contact", "contact")}
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" aria-sort={ariaSort(column.sort)} className={clsx(CELL, column.width, "sticky top-0 bg-bg-subtle")}>
                {header(column.label, column.sort)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              checked={selected.has(contact.id)}
              onToggle={() => onToggle(contact.id)}
              onOpen={() => onOpen(contact)}
              onEdit={(field, value) => onEdit(contact, field, value)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactRow({
  contact,
  checked,
  onToggle,
  onOpen,
  onEdit,
}: {
  contact: Contact;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onEdit: (field: EditableField, value: string) => void;
}) {
  const label = contactLabel(contact);
  return (
    <tr aria-label={`Contact ${label}`} aria-selected={checked} className="group">
      <td className={clsx(CELL, CHECK_BODY, checked ? "bg-accent-soft" : "bg-bg group-hover:bg-bg-hover")}>
        <input type="checkbox" aria-label={`Select ${label}`} checked={checked} onChange={onToggle} className="size-4 accent-primary" />
      </td>
      <td className={clsx(CELL, CONTACT_BODY, checked ? "bg-accent-soft" : "bg-bg group-hover:bg-bg-hover")}>
        <div className="flex items-center gap-2">
          <SubscriptionStatusBadge status={contact.subscription_status} iconOnly />
          <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
          <button
            type="button"
            aria-label={`View ${label}`}
            title="View contact"
            onClick={onOpen}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-bg-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Eye className="size-4" aria-hidden />
          </button>
        </div>
      </td>
      <td className={clsx(CELL, "group-hover:bg-bg-hover")}>
        <SubscriptionStatusBadge status={contact.subscription_status} />
      </td>
      {(["name", "email", "phone", "company"] as const).map((field) => (
        <td key={field} className={clsx(CELL, "group-hover:bg-bg-hover")}>
          <EditableCell label={field} value={contact[field]} contactLabel={label} onSave={(value) => onEdit(field, value)} />
        </td>
      ))}
      <td className={clsx(CELL, "whitespace-nowrap text-text-muted group-hover:bg-bg-hover")}>{formatDateTime(contact.updated_at)}</td>
      <td className={clsx(CELL, "whitespace-nowrap text-text-muted group-hover:bg-bg-hover")}>
        {LAST_UPDATE_SOURCE_LABELS[contact.last_update_source] ?? contact.last_update_source}
      </td>
      <td className={clsx(CELL, "max-w-64 truncate text-text-muted group-hover:bg-bg-hover")}>
        {contact.sources.map(sourceLabel).join(", ")}
      </td>
    </tr>
  );
}

/** A cell that edits where it stands: click, type, Enter or click away to save, Escape to cancel. */
function EditableCell({
  label,
  contactLabel: owner,
  value,
  onSave,
}: {
  label: string;
  contactLabel: string;
  value: string | null;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // Enter saves and then the input loses focus, which would save again; this makes the first finish win.
  const finished = useRef(false);

  function finish(save: boolean) {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    if (save && draft.trim() !== (value ?? "")) onSave(draft.trim());
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label} of ${owner}`}
        onClick={() => {
          finished.current = false;
          setDraft(value ?? "");
          setEditing(true);
        }}
        className="block w-full truncate rounded-input px-1 py-1 text-left hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-accent"
      >
        {value || <span className="text-text-muted/60">Empty</span>}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label={`${label} of ${owner}`}
      type={label === "email" ? "email" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      className="h-8 w-full rounded-input border border-accent bg-field px-2 text-sm text-text focus:outline-none"
    />
  );
}

"use client";

import { ChevronDown, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Drawer, Menu } from "@/components/ui";
import { LAST_UPDATE_SOURCE_LABELS, SUBSCRIPTION_LABELS, contactLabel } from "@/lib/contacts";
import { formatDateTime } from "@/lib/format";
import type { Contact } from "@/lib/queries/contacts";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";

type Props = {
  contact: Contact | null;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm break-words whitespace-pre-line text-text">{children || <span className="text-text-muted">Empty</span>}</dd>
    </div>
  );
}

/** A contact's details in Typeform's right-hand sidebar: properties, subscription history, sources, and Actions. */
export function ContactDrawer({ contact, onClose, onEdit, onDelete }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <Drawer
      open={contact !== null}
      onClose={onClose}
      title={contact ? contactLabel(contact) : ""}
      actions={
        contact && (
          <Menu
            items={[
              { label: "Edit", icon: <Pencil className="size-4 text-text-muted" />, onSelect: () => onEdit(contact) },
              { label: "Delete contact", icon: <Trash2 className="size-4" />, danger: true, separatorBefore: true, onSelect: () => onDelete(contact) },
            ]}
            trigger={(props) => (
              <button
                {...props}
                className="inline-flex h-8 items-center gap-1.5 rounded-input border border-border-strong bg-field px-3 text-sm font-medium text-text-soft hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                Actions
                <ChevronDown className="size-4" aria-hidden />
              </button>
            )}
          />
        )
      }
    >
      {contact && (
        <div className="flex flex-col gap-6">
          <dl className="flex flex-col gap-4">
            <Field label="Email">{contact.email}</Field>
            <Field label="Name">{contact.name}</Field>
            <Field label="Phone">{contact.phone}</Field>
            <Field label="Company">{contact.company}</Field>
            <Field label="Notes">{contact.notes}</Field>
          </dl>

          <section aria-label="Subscription status">
            <h3 className="text-xs font-medium text-text-muted">Subscription status</h3>
            <button
              type="button"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
              className="mt-1 inline-flex items-center gap-2 rounded-input text-sm text-text hover:text-text-soft focus-visible:outline-2 focus-visible:outline-accent"
            >
              <SubscriptionStatusBadge status={contact.subscription_status} />
              <ChevronDown className={historyOpen ? "size-4 rotate-180" : "size-4"} aria-hidden />
              <span className="sr-only">Subscription history</span>
            </button>
            {historyOpen && (
              <ol className="mt-2 flex flex-col gap-1.5 border-l border-border pl-3 text-sm text-text-muted">
                {[...contact.subscription_history].reverse().map((entry, i) => (
                  <li key={i}>
                    {SUBSCRIPTION_LABELS[entry.status]} <span className="text-xs">· {formatDateTime(entry.at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-label="Sources">
            <h3 className="text-xs font-medium text-text-muted">Sources</h3>
            <ul className="mt-1 flex flex-col gap-1.5 text-sm text-text">
              {contact.sources.map((source, i) =>
                source.type === "form" && source.form_title ? (
                  <li key={i}>
                    <Link href={`/forms/${source.form_id}/edit`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                      {source.form_title}
                      <ExternalLink className="size-3.5" aria-label="Open form" />
                    </Link>
                  </li>
                ) : (
                  <li key={i}>{source.type === "csv_import" ? "CSV import" : source.type === "manual" ? "Manual edit" : "A deleted form"}</li>
                ),
              )}
            </ul>
          </section>

          <section aria-label="Automations">
            <h3 className="text-xs font-medium text-text-muted">Automations</h3>
            <p className="mt-1 text-sm text-text-muted">Not enrolled in any active automations.</p>
          </section>

          <p className="border-t border-border pt-4 text-xs text-text-muted">
            Last change {formatDateTime(contact.updated_at)} ({LAST_UPDATE_SOURCE_LABELS[contact.last_update_source] ?? contact.last_update_source}).
            Added {formatDateTime(contact.created_at)}.
          </p>
        </div>
      )}
    </Drawer>
  );
}

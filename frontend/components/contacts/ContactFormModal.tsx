"use client";

import { useId, useState } from "react";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { SELECTABLE_STATUSES, SUBSCRIPTION_LABELS, type SubscriptionStatus } from "@/lib/contacts";
import { useCreateContact, useUpdateContact, type Contact, type ContactInput } from "@/lib/queries/contacts";

const NOTES_MAX = 1000;
const FIELD_MAX = 254;

type Props = {
  open: boolean;
  /** The contact to edit; null adds a new one. */
  contact: Contact | null;
  onClose: () => void;
  onSaved?: (contact: Contact) => void;
};

/**
 * "Add individually" and "Edit". Subscribing someone asks for confirmation first: Typeform wants you to have the
 * contact's consent before they get communications.
 */
export function ContactFormModal({ open, contact, onClose, onSaved }: Props) {
  // Remount when the dialog opens for another contact, so the fields start from that contact.
  return open ? <Form key={contact?.id ?? "new"} contact={contact} onClose={onClose} onSaved={onSaved} /> : null;
}

function Form({ contact, onClose, onSaved }: Omit<Props, "open">) {
  const formId = useId();
  const create = useCreateContact();
  const update = useUpdateContact({ quiet: true });
  const [fields, setFields] = useState({
    email: contact?.email ?? "",
    name: contact?.name ?? "",
    phone: contact?.phone ?? "",
    company: contact?.company ?? "",
    notes: contact?.notes ?? "",
  });
  const [status, setStatus] = useState<SubscriptionStatus>(contact?.subscription_status ?? "never_subscribed");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const pending = create.isPending || update.isPending;
  const set = (field: keyof typeof fields) => (value: string) => {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  async function save() {
    // Blank fields are sent too: that is how a field is cleared. "suppressed" is Typeform's, never sent from here.
    const data: ContactInput = { ...fields, ...(status !== "suppressed" ? { subscription_status: status } : {}) };
    try {
      const saved = contact ? await update.mutateAsync({ id: contact.id, data }) : await create.mutateAsync(data);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      setConfirming(false);
      setErrors(error instanceof ApiError ? error.fieldErrors : { form: "Something went wrong. Please try again." });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const subscribing = status === "subscribed" && contact?.subscription_status !== "subscribed";
    if (subscribing) setConfirming(true);
    else void save();
  }

  const general = errors.form || errors.body;
  // "Suppressed" is Typeform's own status: it is listed only for a contact that already has it, never offered to pick.
  const statuses: SubscriptionStatus[] = contact?.subscription_status === "suppressed" ? ["suppressed", ...SELECTABLE_STATUSES] : SELECTABLE_STATUSES;
  const options = statuses.map((s) => ({ value: s as string, label: SUBSCRIPTION_LABELS[s] }));

  return (
    <>
      <Modal
        open={!confirming}
        onClose={onClose}
        title={contact ? "Edit contact" : "Add contact"}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              Save
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Input label="Email" type="email" autoComplete="off" maxLength={FIELD_MAX} value={fields.email} error={errors.email} onChange={(e) => set("email")(e.target.value)} />
          <Input label="Name" maxLength={FIELD_MAX} value={fields.name} error={errors.name} onChange={(e) => set("name")(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Phone" maxLength={64} value={fields.phone} error={errors.phone} onChange={(e) => set("phone")(e.target.value)} />
            <Input label="Company" maxLength={FIELD_MAX} value={fields.company} error={errors.company} onChange={(e) => set("company")(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Select<string> label="Subscription status" options={options} value={status} onChange={(value) => setStatus(value as SubscriptionStatus)} />
            <p className="text-xs text-text-muted">Ask contacts for their consent before you subscribe them to communications.</p>
            {errors.subscription_status && <p className="text-xs text-danger">{errors.subscription_status}</p>}
          </div>
          <Textarea
            label="Notes"
            rows={3}
            maxLength={NOTES_MAX}
            value={fields.notes}
            error={errors.notes}
            hint={`${fields.notes.length} / ${NOTES_MAX}`}
            onChange={(e) => set("notes")(e.target.value)}
          />
          {general && (
            <p role="alert" className="text-sm text-danger">
              {general}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirm consent"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Back
            </Button>
            <Button onClick={() => void save()} loading={pending}>
              Subscribe
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          You are about to subscribe this contact to communications. Only subscribe people who have given you their consent to be contacted.
        </p>
      </Modal>
    </>
  );
}

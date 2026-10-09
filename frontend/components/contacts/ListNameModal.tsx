"use client";

import { useId, useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { ApiError } from "@/lib/api";

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialName?: string;
  onClose: () => void;
  /** Saves under the name; throw an ApiError to show its message under the field. */
  onSubmit: (name: string) => Promise<unknown>;
};

/** Names a contact list: "Save as new list" and rename. */
export function ListNameModal({ open, ...rest }: Props) {
  return open ? <NameForm {...rest} /> : null;
}

function NameForm({ title, confirmLabel, initialName = "", onClose, onSubmit }: Omit<Props, "open">) {
  const formId = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the list a name");
    setPending(true);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors.name ?? err.message) : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <Input
          label="List name"
          placeholder="e.g. Hot leads"
          maxLength={100}
          autoFocus
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
        />
      </form>
    </Modal>
  );
}

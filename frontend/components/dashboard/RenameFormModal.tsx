"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, Input, Modal } from "@/components/ui";
import type { FormListItem } from "@/lib/types";
import { useLastDefined } from "./useLastDefined";

const TITLE_MAX = 200;

type Props = {
  form: FormListItem | null;
  onClose: () => void;
  onRename: (form: FormListItem, title: string) => void;
};

export function RenameFormModal({ form, onClose, onRename }: Props) {
  const shown = useLastDefined(form);
  return (
    <Modal open={form !== null} onClose={onClose} title="Rename form">
      {/* Keyed so the field resets to the current title for each form. */}
      {shown && <RenameFields key={shown.id} form={shown} onClose={onClose} onRename={onRename} />}
    </Modal>
  );
}

function RenameFields({ form, onClose, onRename }: Props & { form: FormListItem }) {
  const [title, setTitle] = useState(form.title);
  const [error, setError] = useState<string>();
  const formId = useId();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return setError("Title can't be empty");
    if (trimmed !== form.title) onRename(form, trimmed);
    onClose();
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-5">
      <Input
        label="Form title"
        value={title}
        maxLength={TITLE_MAX}
        error={error}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setTitle(e.target.value);
          setError(undefined);
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

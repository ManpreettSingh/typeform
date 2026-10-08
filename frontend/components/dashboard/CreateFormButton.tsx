"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Input, Modal, type ButtonProps } from "@/components/ui";
import { useCreateForm } from "@/lib/queries/forms";

const TITLE_MAX = 200;

/** "Create form" button + title modal; on success opens the builder. */
export function CreateFormButton({ size = "md" }: { size?: ButtonProps["size"] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const formId = useId();
  const router = useRouter();
  const createForm = useCreateForm();

  // Next's <Activity> keeps this mounted after we navigate to the builder; start fresh next time.
  useLayoutEffect(
    () => () => {
      setOpen(false);
      setTitle("");
    },
    [],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createForm.mutate(
      { title: title.trim() || undefined },
      {
        onSuccess: (form) => {
          toast.success("Form created");
          router.push(`/forms/${form.id}/edit`);
        },
      },
    );
  }

  return (
    <>
      <Button size={size} leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        Create form
      </Button>
      <Modal
        open={open}
        onClose={() => !createForm.isPending && setOpen(false)}
        title="Create a new form"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={createForm.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={createForm.isPending}>
              Create
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={onSubmit}>
          <Input
            label="Form title"
            placeholder="Untitled form"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            hint="You can change this later."
          />
        </form>
      </Modal>
    </>
  );
}

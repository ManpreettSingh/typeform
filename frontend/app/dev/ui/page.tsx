"use client";

// Temporary Phase 0 showcase of components/ui. Not linked from product screens.
import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge, Button, ConfirmDialog, IconButton, Input, Menu, Modal, Tabs, Toggle } from "@/components/ui";

type Tab = "create" | "results" | "share";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border p-6">
      <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function UiShowcase() {
  const [tab, setTab] = useState<Tab>("create");
  const [required, setRequired] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-text">UI primitives</h1>

      <Section title="Button">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm" leftIcon={<Plus className="size-4" />}>
          Small with icon
        </Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="IconButton">
        <IconButton label="Edit" icon={<Pencil className="size-4" />} />
        <IconButton label="Duplicate" icon={<Copy className="size-4" />} />
        <IconButton label="Delete" icon={<Trash2 className="size-4" />} size="sm" />
      </Section>

      <Section title="Input">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Input label="Form title" placeholder="My new form" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="With hint" placeholder="name@example.com" hint="We'll never share it." />
          <Input label="With error" defaultValue="not-an-email" error="Hmm… that email doesn't look right" />
          <Input label="Disabled" placeholder="Disabled" disabled />
        </div>
      </Section>

      <Section title="Toggle">
        <Toggle checked={required} onChange={setRequired} label="Required" />
        <Toggle checked={false} onChange={() => {}} label="Disabled" disabled />
      </Section>

      <Section title="Badge">
        <Badge>Draft</Badge>
        <Badge variant="success">Published</Badge>
        <Badge variant="accent">Coming soon</Badge>
        <Badge variant="danger">Error</Badge>
      </Section>

      <Section title="Tabs">
        <Tabs<Tab>
          aria-label="Form sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: "create", label: "Create" },
            { value: "results", label: "Results" },
            { value: "share", label: "Share" },
          ]}
          className="border-b border-border"
        />
        <span className="text-sm text-text-muted">Selected: {tab}</span>
      </Section>

      <Section title="Menu">
        <Menu
          trigger={(props) => <IconButton label="Form actions" icon={<MoreHorizontal className="size-4" />} {...props} />}
          items={[
            { label: "Rename", icon: <Pencil className="size-4" />, onSelect: () => toast("Rename clicked") },
            { label: "Duplicate", icon: <Copy className="size-4" />, onSelect: () => toast("Duplicate clicked") },
            { label: "Delete", icon: <Trash2 className="size-4" />, danger: true, onSelect: () => setConfirmOpen(true) },
          ]}
        />
      </Section>

      <Section title="Modal / ConfirmDialog / Toast">
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Open modal
        </Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Open confirm
        </Button>
        <Button variant="ghost" onClick={() => toast.success("Saved")}>
          Success toast
        </Button>
        <Button variant="ghost" onClick={() => toast.error("Something went wrong")}>
          Error toast
        </Button>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Rename form"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast.success("Renamed");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Input label="Title" placeholder="Untitled form" />
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.success("Deleted");
        }}
        title="Delete this form?"
        message="This permanently deletes the form and all its responses."
        confirmLabel="Delete"
        destructive
      />
    </main>
  );
}

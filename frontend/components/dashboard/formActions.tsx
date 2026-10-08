"use client";

import { BarChart3, CopyPlus, Globe, GlobeLock, Link2, MoreHorizontal, Pencil, Share2, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { IconButton, Menu, type MenuItem } from "@/components/ui";
import type { FormListItem } from "@/lib/types";
import { useCopyLink } from "./useCopyLink";

export type FormCardActions = {
  onRename: (form: FormListItem) => void;
  onDuplicate: (form: FormListItem) => void;
  onDelete: (form: FormListItem) => void;
  onShare: (form: FormListItem) => void;
  onSetPublished: (form: FormListItem, published: boolean) => void;
};

const icon = "size-4 text-text-muted";

/** The ⋯ menu shared by list rows and grid cards. */
export function FormActionsMenu({ form, actions }: { form: FormListItem; actions: FormCardActions }) {
  const router = useRouter();
  const copyLink = useCopyLink();
  const published = form.status === "published";

  const items: MenuItem[] = [
    { label: "Open", icon: <Pencil className={icon} />, onSelect: () => router.push(`/forms/${form.id}/edit`) },
    { label: "Results", icon: <BarChart3 className={icon} />, onSelect: () => router.push(`/forms/${form.id}/results`) },
    ...(published
      ? [
          { label: "Share", icon: <Share2 className={icon} />, onSelect: () => actions.onShare(form) },
          { label: "Copy link", icon: <Link2 className={icon} />, onSelect: () => copyLink(form.slug) },
        ]
      : []),
    { label: "Rename", icon: <Type className={icon} />, onSelect: () => actions.onRename(form), separatorBefore: true },
    { label: "Duplicate", icon: <CopyPlus className={icon} />, onSelect: () => actions.onDuplicate(form) },
    published
      ? { label: "Unpublish", icon: <GlobeLock className={icon} />, onSelect: () => actions.onSetPublished(form, false) }
      : { label: "Publish", icon: <Globe className={icon} />, onSelect: () => actions.onSetPublished(form, true) },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      danger: true,
      separatorBefore: true,
      onSelect: () => actions.onDelete(form),
    },
  ];

  return (
    <Menu
      className="relative z-10"
      items={items}
      trigger={(props) => (
        <IconButton {...props} size="sm" label={`Actions for ${form.title}`} icon={<MoreHorizontal className="size-4" />} />
      )}
    />
  );
}

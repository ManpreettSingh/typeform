"use client";

import {
  BarChart3,
  Copy,
  CopyPlus,
  Globe,
  GlobeLock,
  Link2,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, IconButton, Menu, Skeleton, type MenuItem } from "@/components/ui";
import { formatDateTime, formatRelativeTime, pluralize } from "@/lib/format";
import type { FormListItem } from "@/lib/types";
import { useCopyLink } from "./useCopyLink";

// Literal class names so Tailwind generates them; tokens live in globals.css.
const THUMBNAILS = ["bg-thumb-1", "bg-thumb-2", "bg-thumb-3", "bg-thumb-4", "bg-thumb-5", "bg-thumb-6"];

export type FormCardActions = {
  onRename: (form: FormListItem) => void;
  onDuplicate: (form: FormListItem) => void;
  onDelete: (form: FormListItem) => void;
  onShare: (form: FormListItem) => void;
  onSetPublished: (form: FormListItem, published: boolean) => void;
};

const icon = "size-4 text-text-muted";

export function FormCard({ form, actions }: { form: FormListItem; actions: FormCardActions }) {
  const router = useRouter();
  const copyLink = useCopyLink();
  const published = form.status === "published";
  const editHref = `/forms/${form.id}/edit`;
  const resultsHref = `/forms/${form.id}/results`;

  const items: MenuItem[] = [
    { label: "Open", icon: <Pencil className={icon} />, onSelect: () => router.push(editHref) },
    { label: "Results", icon: <BarChart3 className={icon} />, onSelect: () => router.push(resultsHref) },
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
    <article
      className={
        "group relative flex flex-col rounded-card border border-border bg-bg transition-shadow duration-200 " +
        "hover:shadow-popover has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-accent"
      }
    >
      <div
        aria-hidden
        className={`flex aspect-[16/9] items-end rounded-t-card p-4 ${THUMBNAILS[form.id % THUMBNAILS.length]}`}
      >
        <span className="line-clamp-2 text-lg leading-snug font-medium text-thumb-fg">{form.title}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-text">
            {/* Stretched link: the whole card opens the builder; controls below sit above it (z-10). */}
            <Link data-card-link href={editHref} className="after:absolute after:inset-0 focus:outline-none">
              {form.title}
            </Link>
          </h3>
          <Menu
            className="relative z-10 -mt-1 -mr-2"
            items={items}
            trigger={(props) => (
              <IconButton {...props} size="sm" label={`Actions for ${form.title}`} icon={<MoreHorizontal className="size-4" />} />
            )}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Badge variant={published ? "success" : "neutral"}>{published ? "Published" : "Draft"}</Badge>
          <span>{form.response_count === 0 ? "No responses" : pluralize(form.response_count, "response")}</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-text-muted">
          <time dateTime={form.updated_at} title={formatDateTime(form.updated_at)}>
            Updated {formatRelativeTime(form.updated_at)}
          </time>
          <div className="relative z-10 flex items-center gap-1">
            {published && (
              <IconButton
                size="sm"
                label="Copy public link"
                icon={<Copy className="size-3.5" />}
                onClick={() => copyLink(form.slug)}
              />
            )}
            <Link
              href={resultsHref}
              className="rounded-input px-1.5 py-1 font-medium text-text-muted hover:bg-bg-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
            >
              Results
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function FormCardSkeleton() {
  return (
    <div className="flex flex-col rounded-card border border-border">
      <Skeleton className="aspect-[16/9] rounded-none rounded-t-card" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { Badge, Skeleton } from "@/components/ui";
import { formatDateTime, formatRelativeTime, pluralize } from "@/lib/format";
import type { FormListItem } from "@/lib/types";
import { FormActionsMenu, type FormCardActions } from "./formActions";
import { FormThemeThumb } from "./FormThemePreview";

export type { FormCardActions } from "./formActions";

/** One form in the Grid view: colored thumbnail with the title, then status, responses and the ⋯ menu. */
export function FormCard({ form, actions }: { form: FormListItem; actions: FormCardActions }) {
  const published = form.status === "published";
  return (
    <article
      className={clsx(
        "group relative flex flex-col overflow-hidden rounded-row border border-border-strong bg-bg",
        "transition-shadow duration-150 hover:shadow-row has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-accent",
      )}
    >
      <FormThemeThumb
        theme={form.theme}
        title={
          // Stretched link: the whole card opens the builder; the ⋯ menu sits above it (z-10).
          <Link data-card-link href={`/forms/${form.id}/edit`} className="after:absolute after:inset-0 focus:outline-none">
            {form.title}
          </Link>
        }
      />
      <div className="flex items-center justify-between gap-2 border-t border-border-strong py-2 pr-1.5 pl-3 text-xs text-text-muted">
        <div className="flex min-w-0 items-center gap-2">
          {published ? (
            <span className="truncate">{pluralize(form.response_count, "response")}</span>
          ) : (
            <Badge>Draft</Badge>
          )}
          <time className="truncate" dateTime={form.updated_at} title={formatDateTime(form.updated_at)}>
            · {formatRelativeTime(form.updated_at)}
          </time>
        </div>
        <FormActionsMenu form={form} actions={actions} />
      </div>
    </article>
  );
}

export function FormCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-row border border-border-strong bg-bg">
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

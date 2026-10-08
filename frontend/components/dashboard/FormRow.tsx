"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { Badge, Skeleton } from "@/components/ui";
import { completionPercent, formatDate, formatDateTime } from "@/lib/format";
import type { FormListItem } from "@/lib/types";
import { FormActionsMenu, type FormCardActions } from "./formActions";
import { FormThemeIcon } from "./FormThemePreview";

/** Columns shared by the header and every row, so they always line up. */
export const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_40px] sm:grid-cols-[minmax(0,1fr)_96px_104px_128px_40px] items-center";

export function FormListHeader() {
  return (
    <div className={clsx(ROW_GRID, "px-2.5 pt-4 pb-2 text-sm text-text-muted sm:pt-8 sm:pb-2.5")} aria-hidden>
      <span />
      <span className="hidden text-center sm:block">Responses</span>
      <span className="hidden text-center sm:block">Completion</span>
      <span className="hidden text-center sm:block">Updated</span>
      <span />
    </div>
  );
}

/** One form in Typeform's list view: colored icon, title, counts, date, ⋯ menu. The whole row opens the builder. */
export function FormRow({ form, actions }: { form: FormListItem; actions: FormCardActions }) {
  const completion = completionPercent(form.response_count, form.response_total);
  return (
    <article
      className={clsx(
        ROW_GRID,
        "group relative h-12 rounded-row border border-border-strong bg-bg pr-1 pl-2 text-sm text-text-muted",
        "transition-shadow duration-150 hover:shadow-row has-[a[data-row-link]:focus-visible]:ring-2 has-[a[data-row-link]:focus-visible]:ring-accent",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <FormThemeIcon theme={form.theme} />
        <h3 className="min-w-0 truncate font-medium text-text">
          {/* Stretched link: the whole row opens the builder; the ⋯ menu sits above it (z-10). */}
          <Link data-row-link href={`/forms/${form.id}/edit`} className="after:absolute after:inset-0 focus:outline-none">
            {form.title}
          </Link>
        </h3>
        {form.status === "draft" && <Badge>Draft</Badge>}
      </div>
      <span className="hidden text-center tabular-nums sm:block">{form.response_count || "–"}</span>
      <span className="hidden text-center tabular-nums sm:block">{completion === null ? "–" : `${completion}%`}</span>
      <time className="hidden text-center sm:block" dateTime={form.updated_at} title={formatDateTime(form.updated_at)}>
        {formatDate(form.updated_at)}
      </time>
      <div className="flex justify-center">
        <FormActionsMenu form={form} actions={actions} />
      </div>
    </article>
  );
}

export function FormRowSkeleton() {
  return (
    <div className={clsx(ROW_GRID, "h-12 rounded-row border border-border-strong bg-bg px-2")}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-field" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}

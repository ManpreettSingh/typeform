"use client";

import { clsx } from "clsx";
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useLayoutEffect, useState, type KeyboardEvent } from "react";
import { Button, EmptyState, IconButton, Skeleton } from "@/components/ui";
import { formatAnswer } from "@/lib/answerFormat";
import { formatDateTime, pluralize } from "@/lib/format";
import { RESPONSES_PAGE_SIZE, exportCsvUrl, useDeleteResponse, useResponses } from "@/lib/queries/results";
import type { Question } from "@/lib/types";
import { ResponseDrawer } from "./ResponseDrawer";
import { StatusBadge } from "./StatusBadge";

type Props = { formId: number; questions: Question[] };

export function ResponsesView({ formId, questions }: Props) {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isPending, isError, refetch, isFetching, isPlaceholderData } = useResponses(formId, page);
  const deleteResponse = useDeleteResponse(formId);

  // Next's <Activity> keeps this mounted while hidden; don't come back to an open drawer.
  useLayoutEffect(() => () => setSelectedId(null), []);

  if (isPending) return <TableSkeleton />;
  if (isError) {
    return (
      <EmptyState
        tone="danger"
        icon={<AlertTriangle className="size-6" />}
        title="Couldn't load responses"
        action={
          <Button onClick={() => void refetch()} loading={isFetching}>
            Try again
          </Button>
        }
      />
    );
  }

  const { items, total } = data;
  const lastPage = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * RESPONSES_PAGE_SIZE + 1;
  const to = Math.min(page * RESPONSES_PAGE_SIZE, total);

  const index = items.findIndex((r) => r.id === selectedId);
  const selected = index === -1 ? null : items[index];

  async function remove(id: number) {
    await deleteResponse.mutateAsync(id);
    setSelectedId(null);
    // Deleting the only row on the last page would leave an empty page.
    if (items.length === 1 && page > 1) setPage(page - 1);
  }

  const openOnKey = (e: KeyboardEvent, id: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId(id);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {pluralize(total, "response")} · click a row to see it in full
        </p>
        <a
          href={exportCsvUrl(formId)}
          download
          className="inline-flex h-8 items-center gap-1.5 rounded-input border border-border bg-bg px-3 text-sm font-medium text-text transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Download className="size-4" aria-hidden />
          Export CSV
        </a>
      </div>

      <div className={clsx("overflow-x-auto rounded-card border border-border bg-bg", isPlaceholderData && "opacity-60")}>
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <caption className="sr-only">Responses, newest first</caption>
          <thead>
            <tr className="border-b border-border text-xs font-medium text-text-muted">
              <th scope="col" className="sticky left-0 bg-bg px-4 py-3 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              {questions.map((q, i) => (
                <th key={q.id} scope="col" className="max-w-56 px-4 py-3 font-medium">
                  <span className="block truncate" title={q.title}>
                    {i + 1}. {q.title.trim() || "Untitled question"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                aria-label={`Response from ${formatDateTime(r.submitted_at ?? r.started_at)}`}
                onClick={() => setSelectedId(r.id)}
                onKeyDown={(e) => openOnKey(e, r.id)}
                className={clsx(
                  "group cursor-pointer border-b border-border last:border-b-0 hover:bg-bg-subtle",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  r.id === selectedId && "bg-accent-soft",
                )}
              >
                <td
                  className={clsx(
                    "sticky left-0 px-4 py-3 whitespace-nowrap text-text",
                    r.id === selectedId ? "bg-accent-soft" : "bg-bg group-hover:bg-bg-subtle",
                  )}
                >
                  {formatDateTime(r.submitted_at ?? r.started_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                {questions.map((q) => {
                  const text = formatAnswer(q, r.answers[q.id]);
                  return (
                    <td key={q.id} className="max-w-56 px-4 py-3">
                      {text ? (
                        <span className="block truncate text-text" title={text}>
                          {text}
                        </span>
                      ) : (
                        <span className="text-text-muted">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-sm text-text-muted">
          <span className="tabular-nums">
            {from}–{to} of {total}
          </span>
          <IconButton
            label="Previous page"
            icon={<ChevronLeft className="size-4" />}
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          />
          <IconButton
            label="Next page"
            icon={<ChevronRight className="size-4" />}
            disabled={page >= lastPage}
            onClick={() => setPage(page + 1)}
          />
        </nav>
      )}

      <ResponseDrawer
        response={selected}
        questions={questions}
        onClose={() => setSelectedId(null)}
        onNewer={index > 0 ? () => setSelectedId(items[index - 1].id) : undefined}
        onOlder={index !== -1 && index < items.length - 1 ? () => setSelectedId(items[index + 1].id) : undefined}
        onDelete={(r) => remove(r.id)}
        deleting={deleteResponse.isPending}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-bg p-4" aria-busy="true" aria-label="Loading responses">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  );
}

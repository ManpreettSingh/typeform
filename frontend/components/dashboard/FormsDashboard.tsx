"use client";

import { AlertTriangle, FileText, SearchX } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { Button, ConfirmDialog, EmptyState } from "@/components/ui";
import { pluralize } from "@/lib/format";
import {
  toListItem,
  useDeleteForm,
  useDuplicateForm,
  useForms,
  useRenameForm,
  useSetPublished,
} from "@/lib/queries/forms";
import type { FormListItem } from "@/lib/types";
import { CreateFormButton } from "./CreateFormButton";
import { FormCard, FormCardSkeleton, type FormCardActions } from "./FormCard";
import { FormsToolbar, sortForms, type SortKey } from "./FormsToolbar";
import { RenameFormModal } from "./RenameFormModal";
import { ShareFormModal } from "./ShareFormModal";
import { useLastDefined } from "./useLastDefined";

type Dialog = { kind: "rename" | "delete" | "share"; form: FormListItem } | null;

const SKELETON_COUNT = 8;
const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function FormsDashboard() {
  const forms = useForms();
  const renameForm = useRenameForm();
  const deleteForm = useDeleteForm();
  const duplicateForm = useDuplicateForm();
  const setPublished = useSetPublished();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [dialog, setDialog] = useState<Dialog>(null);

  // Next's <Activity> keeps this page mounted while hidden; don't return to a stale open dialog.
  useLayoutEffect(() => () => setDialog(null), []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (forms.data ?? []).filter((f) => f.title.toLowerCase().includes(needle));
    return sortForms(matches, sort);
  }, [forms.data, query, sort]);

  const actions: FormCardActions = {
    onRename: (form) => setDialog({ kind: "rename", form }),
    onDelete: (form) => setDialog({ kind: "delete", form }),
    onShare: (form) => setDialog({ kind: "share", form }),
    onDuplicate: (form) => duplicateForm.mutate(form),
    onSetPublished: (form, published) =>
      setPublished.mutate(
        { id: form.id, published },
        // Publishing is usually followed by sharing, so offer the link right away.
        { onSuccess: (updated) => published && setDialog({ kind: "share", form: toListItem(updated) }) },
      ),
  };

  const closeDialog = () => setDialog(null);
  const deleting = useLastDefined(dialog?.kind === "delete" ? dialog.form : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">My workspace</h1>
          {forms.data && <p className="mt-1 text-sm text-text-muted">{pluralize(forms.data.length, "form")}</p>}
        </div>
        {forms.data && forms.data.length > 0 && (
          <FormsToolbar query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} />
        )}
      </div>

      {forms.isPending ? (
        <div className={GRID} aria-busy="true" aria-label="Loading forms">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <FormCardSkeleton key={i} />
          ))}
        </div>
      ) : forms.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="size-6" />}
          title="Couldn't load your forms"
          description={forms.error.message}
          action={
            <Button variant="secondary" loading={forms.isFetching} onClick={() => forms.refetch()}>
              Try again
            </Button>
          }
        />
      ) : forms.data.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No forms yet"
          description="Create your first form to start collecting responses, one question at a time."
          action={<CreateFormButton />}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title={`No forms match “${query.trim()}”`}
          action={
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className={GRID}>
          {visible.map((form) => (
            <FormCard key={form.id} form={form} actions={actions} />
          ))}
        </div>
      )}

      <RenameFormModal
        form={dialog?.kind === "rename" ? dialog.form : null}
        onClose={closeDialog}
        onRename={(form, title) => renameForm.mutate({ id: form.id, title })}
      />
      <ShareFormModal form={dialog?.kind === "share" ? dialog.form : null} onClose={closeDialog} />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onClose={closeDialog}
        onConfirm={() => {
          if (dialog?.kind === "delete") deleteForm.mutate(dialog.form);
          closeDialog();
        }}
        title="Delete this form?"
        message={
          deleting && (
            <>
              “{deleting.title}” and{" "}
              {deleting.response_count === 0
                ? "its questions"
                : `all ${pluralize(deleting.response_count, "response")}`}{" "}
              will be permanently deleted. This can&rsquo;t be undone.
            </>
          )
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

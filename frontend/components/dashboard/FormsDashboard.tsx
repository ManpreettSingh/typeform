"use client";

import { AlertTriangle, FileText, Search, SearchX } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { Button, ConfirmDialog, EmptyState, Input } from "@/components/ui";
import { pluralize } from "@/lib/format";
import {
  toListItem,
  useDeleteForm,
  useDuplicateForm,
  useForms,
  useRenameForm,
  useSetPublished,
} from "@/lib/queries/forms";
import { useWorkspaces } from "@/lib/queries/workspaces";
import type { FormListItem } from "@/lib/types";
import { CreateFormButton } from "./CreateFormButton";
import { FormCard, FormCardSkeleton, type FormCardActions } from "./FormCard";
import { FormListHeader, FormRow, FormRowSkeleton } from "./FormRow";
import { FormsToolbar, sortForms, type SortKey } from "./FormsToolbar";
import { RenameFormModal } from "./RenameFormModal";
import { ShareFormModal } from "./ShareFormModal";
import { useLastDefined } from "./useLastDefined";
import { useWorkspaceView } from "./useWorkspaceView";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

type Dialog = { kind: "rename" | "delete" | "share"; form: FormListItem } | null;

const SKELETON_COUNT = 4;
const GRID = "grid grid-cols-1 gap-4 pt-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function FormsDashboard() {
  const [activeWorkspace, setActiveWorkspace] = useState(1);
  const forms = useForms(activeWorkspace);
  const renameForm = useRenameForm();
  const deleteForm = useDeleteForm();
  const duplicateForm = useDuplicateForm();
  const setPublished = useSetPublished();
  const { data: workspaces } = useWorkspaces();

  const [query, setQuery] = useState("");
  // Typeform's workspace defaults to "Date created", newest first.
  const [sort, setSort] = useState<SortKey>("created");
  const [view, setView] = useWorkspaceView();
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

  const totals = useMemo(() => {
    if (!forms.data) return null;
    const completed = forms.data.reduce((sum, f) => sum + f.response_count, 0);
    const all = forms.data.reduce((sum, f) => sum + f.response_total, 0);
    return { completed, inProgress: all - completed };
  }, [forms.data]);
  
  const currentWorkspaceName = workspaces?.find(w => w.id === activeWorkspace)?.name ?? "My workspace";

  return (
    <>
      <WorkspaceSidebar
        query={query}
        onQueryChange={setQuery}
        formCount={forms.data?.length ?? null}
        totals={totals}
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
      />
      <section aria-label="Forms" className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <h1 className="text-2xl font-normal text-text">{currentWorkspaceName}</h1>
          {forms.data && forms.data.length > 0 && (
            <FormsToolbar sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
          )}
        </div>
        {/* The sidebar (Create form + search) is hidden on small screens; offer both here instead. */}
        <div className="flex gap-3 pt-4 md:hidden">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              aria-label="Search forms"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="size-4" />}
            />
          </div>
          <CreateFormButton activeWorkspace={activeWorkspace} />
        </div>

        {forms.isPending ? (
          view === "grid" ? (
            <div className={GRID} aria-busy="true" aria-label="Loading forms">
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <FormCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div aria-busy="true" aria-label="Loading forms">
              <FormListHeader />
              <div className="flex flex-col gap-2">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <FormRowSkeleton key={i} />
                ))}
              </div>
            </div>
          )
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
            action={<CreateFormButton activeWorkspace={activeWorkspace} />}
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
        ) : view === "grid" ? (
          <div className={GRID}>
            {visible.map((form) => (
              <FormCard key={form.id} form={form} actions={actions} />
            ))}
          </div>
        ) : (
          <div>
            <FormListHeader />
            <div className="flex flex-col gap-2">
              {visible.map((form) => (
                <FormRow key={form.id} form={form} actions={actions} />
              ))}
            </div>
          </div>
        )}
      </section>

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
    </>
  );
}

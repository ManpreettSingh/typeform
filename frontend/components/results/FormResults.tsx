"use client";

import { AlertTriangle, ArrowLeft, FileQuestion, Inbox } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { ShareFormModal } from "@/components/dashboard/ShareFormModal";
import { Button, ConfirmDialog, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useForm, useSetPublished } from "@/lib/queries/forms";
import { useSummary } from "@/lib/queries/results";
import { ResponsesView } from "./ResponsesView";
import { ResultsHeader } from "./ResultsHeader";
import { SummaryView } from "./SummaryView";

type View = "summary" | "responses";

export function FormResults() {
  const { id } = useParams<{ id: string }>();
  const formId = Number(id);
  const form = useForm(formId);
  const summary = useSummary(formId);
  const setPublished = useSetPublished();
  const [view, setView] = useState<View>("summary");
  const [dialog, setDialog] = useState<"share" | "publish-to-share" | null>(null);

  // Next's <Activity> keeps this mounted while hidden; don't come back to an open dialog.
  useLayoutEffect(() => () => setDialog(null), []);

  const notFound =
    !Number.isInteger(formId) || (form.error instanceof ApiError && form.error.status === 404);
  if (notFound) {
    return (
      <Message
        icon={<FileQuestion className="size-6" />}
        title="Form not found"
        description="It may have been deleted."
      />
    );
  }
  if (form.isError || summary.isError) {
    return (
      <Message
        tone="danger"
        icon={<AlertTriangle className="size-6" />}
        title="Couldn't load results"
        description={(form.error ?? summary.error)?.message}
        action={
          <Button
            loading={form.isFetching || summary.isFetching}
            onClick={() => {
              void form.refetch();
              void summary.refetch();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }
  if (form.isPending || summary.isPending) return <ResultsSkeleton />;

  const data = summary.data;
  const published = form.data.status === "published";
  const share = () => setDialog(published ? "share" : "publish-to-share");

  return (
    <div className="flex flex-1 flex-col bg-bg-subtle">
      <ResultsHeader form={form.data} onShare={share} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
        {data.total_responses === 0 ? (
          <EmptyState
            className="rounded-card border border-border bg-bg"
            icon={<Inbox className="size-6" />}
            title="No responses yet"
            description={
              published
                ? "Share your form to start collecting responses. They'll show up here as soon as they arrive."
                : "This form is a draft. Publish it and share the link to start collecting responses."
            }
            action={<Button onClick={share}>{published ? "Share form" : "Publish & share"}</Button>}
          />
        ) : (
          <>
            <Tabs<View>
              aria-label="Results views"
              value={view}
              onChange={setView}
              items={[
                { value: "summary", label: "Summary" },
                { value: "responses", label: `Responses (${data.total_responses})` },
              ]}
              className="border-b border-border"
            />
            <div role="tabpanel" aria-label={view === "summary" ? "Summary" : "Responses"}>
              {view === "summary" ? (
                <SummaryView
                  summary={data}
                  questions={form.data.questions}
                  onShowResponses={() => setView("responses")}
                />
              ) : (
                <ResponsesView formId={formId} questions={form.data.questions} />
              )}
            </div>
          </>
        )}
      </main>

      <ShareFormModal form={dialog === "share" ? form.data : null} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === "publish-to-share"}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          setPublished.mutate(
            { id: formId, published: true },
            { onSuccess: () => setDialog("share"), onError: () => setDialog(null) },
          )
        }
        loading={setPublished.isPending}
        title="Publish to share"
        message="This form is a draft. Publish it to get a public link anyone can fill in."
        confirmLabel="Publish"
      />
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-bg-subtle" aria-busy="true" aria-label="Loading results">
      <div className="flex h-14 items-center gap-3 border-b border-border bg-bg px-4">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

function Message(props: React.ComponentProps<typeof EmptyState> & { action?: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center">
      <EmptyState
        {...props}
        action={
          <div className="flex items-center gap-3">
            {props.action}
            <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <ArrowLeft className="size-4" aria-hidden /> Back to workspace
            </Link>
          </div>
        }
      />
    </main>
  );
}

"use client";

import { AlertTriangle, FileQuestion, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { Button, EmptyState } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { usePublicForm } from "@/lib/queries/public";
import type { PublicQuestion } from "@/lib/types";
import { RespondentFlow } from "./RespondentFlow";
import { RespondentTheme } from "./RespondentTheme";
import { usePartialResponse } from "./usePartialResponse";

const NO_QUESTIONS: PublicQuestion[] = [];

/** The public `/f/{slug}` page: loads a published form and runs the respondent flow. */
export function PublicFormView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: form, error, isPending, refetch, isRefetching } = usePublicForm(slug);

  const { saveProgress, complete } = usePartialResponse(slug, form?.questions ?? NO_QUESTIONS);

  if (isPending) return <PublicFormLoading />;

  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <StatusScreen
          icon={<FileQuestion className="size-6" aria-hidden />}
          title="This form isn't available"
          description="It may have been unpublished, or the link is wrong. Check with whoever sent it to you."
        />
      );
    }
    return (
      <StatusScreen
        tone="danger"
        icon={<AlertTriangle className="size-6" aria-hidden />}
        title="Couldn't load this form"
        description={error.message}
        action={
          <Button onClick={() => void refetch()} loading={isRefetching}>
            Try again
          </Button>
        }
      />
    );
  }

  const description = form.description?.trim();
  return (
    <RespondentTheme theme={form.theme} className="flex h-dvh flex-col">
      <title>{form.title}</title>
      <main className="min-h-0 flex-1">
        <RespondentFlow
          questions={form.questions}
          thankYou={form.thank_you}
          welcome={description ? { title: form.title, description } : null}
          onComplete={complete}
          onProgress={saveProgress}
        />
      </main>
    </RespondentTheme>
  );
}

export function PublicFormLoading() {
  return (
    <div role="status" className="flex h-dvh items-center justify-center bg-bg text-text-muted">
      <Loader2 className="size-8 animate-spin" aria-hidden />
      <span className="sr-only">Loading form…</span>
    </div>
  );
}

function StatusScreen(props: React.ComponentProps<typeof EmptyState>) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg">
      <EmptyState {...props} />
    </main>
  );
}

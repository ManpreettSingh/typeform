"use client";

import { useCallback, useRef } from "react";
import { ApiError } from "@/lib/api";
import { publicApi } from "@/lib/queries/public";
import type { Answers, PartialStartOut, PublicQuestion } from "@/lib/types";
import { toSubmission } from "@/lib/validation";

/**
 * Partial responses (bonus): the first move forward starts a response, every later one saves a snapshot of the
 * answers, and the final submit completes that same response. Moving past the question before a Partial Submit Point
 * (`partialSubmit`) makes the server count the response as submitted already.
 *
 * Saving progress is best-effort and silent: if it fails, the respondent isn't bothered and the final submit
 * falls back to a plain `POST …/responses`.
 */
export function usePartialResponse(slug: string, questions: PublicQuestion[]) {
  const started = useRef<Promise<PartialStartOut | null> | null>(null);
  // Snapshots are sent one after another so an older one can never land last.
  const chain = useRef<Promise<void>>(Promise.resolve());

  const ensureStarted = useCallback(() => {
    started.current ??= publicApi.start(slug).catch(() => {
      started.current = null; // try again on the next move
      return null;
    });
    return started.current;
  }, [slug]);

  const saveProgress = useCallback(
    (answers: Answers, partialSubmit = false) => {
      const body = toSubmission(questions, answers);
      const pending = ensureStarted();
      chain.current = chain.current.then(async () => {
        const response = await pending;
        if (!response) return;
        await publicApi
          .saveProgress(response.response_id, { ...body, token: response.token, ...(partialSubmit && { partial_submit: true }) })
          .catch(() => {});
      });
    },
    [ensureStarted, questions],
  );

  const complete = useCallback(
    async (answers: Answers) => {
      const body = toSubmission(questions, answers);
      await chain.current;
      const response = started.current ? await started.current : null;
      if (!response) return void (await publicApi.submit(slug, body));
      try {
        await publicApi.saveProgress(response.response_id, { ...body, token: response.token, complete: true });
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        // 409: an earlier attempt went through (e.g. its reply was lost), so it's done.
        if (error.status === 409) return;
        // 404: the partial response is gone (deleted by the creator); submit afresh. Unpublished forms 404 there too.
        if (error.status === 404) return void (await publicApi.submit(slug, body));
        throw error;
      }
    },
    [questions, slug],
  );

  return { saveProgress, complete };
}

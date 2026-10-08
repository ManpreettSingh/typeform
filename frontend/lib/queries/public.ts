"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { PublicForm, SubmissionIn, SubmissionOut } from "@/lib/types";

export const publicApi = {
  getForm: (slug: string) => apiGet<PublicForm>(`/public/forms/${encodeURIComponent(slug)}`),
  submit: (slug: string, data: SubmissionIn) =>
    apiPost<SubmissionOut>(`/public/forms/${encodeURIComponent(slug)}/responses`, data),
};

export const publicKeys = {
  form: (slug: string) => ["public", "form", slug] as const,
};

/** Loaded once per visit: refetching mid-fill could swap questions under the respondent. */
export function usePublicForm(slug: string) {
  return useQuery({
    queryKey: publicKeys.form(slug),
    queryFn: () => publicApi.getForm(slug),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // 404 = draft or missing; retrying won't change that.
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

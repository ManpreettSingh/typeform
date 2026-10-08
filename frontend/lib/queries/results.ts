"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL, apiDelete, apiGet, getErrorMessage } from "@/lib/api";
import type { FormSummary, ResponseDetail, ResponsePage } from "@/lib/types";
import { formKeys } from "./forms";

export const RESPONSES_PAGE_SIZE = 20;

export const resultsApi = {
  summary: (formId: number) => apiGet<FormSummary>(`/forms/${formId}/summary`),
  responses: (formId: number, page: number, pageSize = RESPONSES_PAGE_SIZE) =>
    apiGet<ResponsePage>(`/forms/${formId}/responses?page=${page}&page_size=${pageSize}`),
  response: (formId: number, responseId: number) =>
    apiGet<ResponseDetail>(`/forms/${formId}/responses/${responseId}`),
  remove: (formId: number, responseId: number) => apiDelete(`/forms/${formId}/responses/${responseId}`),
};

/** Plain link (not fetch) so the browser downloads the file with the server's filename. */
export const exportCsvUrl = (formId: number) => `${API_URL}/forms/${formId}/responses/export.csv`;

export const resultsKeys = {
  all: (formId: number) => ["results", formId] as const,
  summary: (formId: number) => [...resultsKeys.all(formId), "summary"] as const,
  responses: (formId: number, page: number) => [...resultsKeys.all(formId), "responses", page] as const,
};

// New submissions can arrive any time: refetch whenever the creator comes back to the tab.
const live = { staleTime: 0, refetchOnWindowFocus: true } as const;

export function useSummary(formId: number) {
  return useQuery({ queryKey: resultsKeys.summary(formId), queryFn: () => resultsApi.summary(formId), ...live });
}

export function useResponses(formId: number, page: number) {
  return useQuery({
    queryKey: resultsKeys.responses(formId, page),
    queryFn: () => resultsApi.responses(formId, page),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
    ...live,
  });
}

export function useDeleteResponse(formId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (responseId: number) => resultsApi.remove(formId, responseId),
    onSuccess: () => {
      toast.success("Response deleted");
      void qc.invalidateQueries({ queryKey: resultsKeys.all(formId) });
      // Dashboard response counts.
      void qc.invalidateQueries({ queryKey: formKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

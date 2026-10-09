"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import type { AiPrompt, Form, FormCreate, FormListItem, FormUpdate } from "@/lib/types";

// ---- API ---------------------------------------------------------------

export const formsApi = {
  list: (workspaceId?: number) => apiGet<FormListItem[]>(workspaceId ? `/forms?workspace_id=${workspaceId}` : "/forms"),
  get: (id: number) => apiGet<Form>(`/forms/${id}`),
  create: (data: FormCreate) => apiPost<Form>("/forms", data),
  update: (id: number, data: FormUpdate) => apiPatch<Form>(`/forms/${id}`, data),
  remove: (id: number) => apiDelete(`/forms/${id}`),
  duplicate: (id: number) => apiPost<Form>(`/forms/${id}/duplicate`),
  publish: (id: number) => apiPost<Form>(`/forms/${id}/publish`),
  unpublish: (id: number) => apiPost<Form>(`/forms/${id}/unpublish`),
};

/** Typeform AI (Gemini on the server). */
export const aiApi = {
  /** A new form drafted from the prompt. */
  createForm: (prompt: string) => apiPost<Form>("/ai/forms", { prompt } satisfies AiPrompt),
  /** Adds drafted questions to an existing form (and names it if it's still "New form"). */
  addQuestions: (id: number, prompt: string) => apiPost<Form>(`/ai/forms/${id}/questions`, { prompt } satisfies AiPrompt),
};

export const formKeys = {
  all: ["forms"] as const,
  list: (workspaceId?: number) => [...formKeys.all, "list", workspaceId] as const,
  detail: (id: number) => [...formKeys.all, "detail", id] as const,
};

// ---- Helpers -----------------------------------------------------------

/** `responseTotal` (partial included) isn't on the detail shape; callers pass the list's value when they have it. */
export function toListItem(form: Form, responseTotal = form.response_count): FormListItem {
  const { id, slug, workspace_id, title, status, response_count, created_at, updated_at, published_at, theme } = form;
  return {
    id,
    slug,
    workspace_id,
    title,
    status,
    response_count,
    created_at,
    updated_at,
    published_at,
    question_count: form.questions.length,
    response_total: responseTotal,
    theme,
  };
}

/** Every cached form list (one per workspace, plus the unfiltered one). */
const allLists = { queryKey: [...formKeys.all, "list"] };

/**
 * Writes a fresh server copy of a form into the detail cache and every cached list: replaced where it's already
 * listed, added to the top of its own workspace's list (and the unfiltered one) when it's new.
 */
export function storeForm(qc: QueryClient, form: Form) {
  qc.setQueryData(formKeys.detail(form.id), form);
  for (const [key, list] of qc.getQueriesData<FormListItem[]>(allLists)) {
    if (!list) continue;
    const workspaceId = key[2];
    const existing = list.find((f) => f.id === form.id);
    if (existing) {
      const item = toListItem(form, existing.response_total);
      qc.setQueryData(key, list.map((f) => (f.id === form.id ? item : f)));
    } else if (workspaceId === undefined || workspaceId === form.workspace_id) {
      qc.setQueryData(key, [toListItem(form), ...list]);
    }
  }
}

/** Optimistically edits every cached list; returns a rollback. */
export async function patchLists(qc: QueryClient, update: (list: FormListItem[]) => FormListItem[]) {
  await qc.cancelQueries(allLists);
  const previous = qc.getQueriesData<FormListItem[]>(allLists);
  for (const [key, list] of previous) if (list) qc.setQueryData(key, update(list));
  return () => {
    for (const [key, list] of previous) qc.setQueryData(key, list);
  };
}

// ---- Hooks -------------------------------------------------------------

export function useForms(workspaceId?: number) {
  // staleTime 0: the builder edits forms too, so refresh whenever the dashboard is shown.
  return useQuery({ queryKey: formKeys.list(workspaceId), queryFn: () => formsApi.list(workspaceId), staleTime: 0 });
}

export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: formsApi.create,
    onSuccess: (form) => storeForm(qc, form),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/** AI errors (no key, rate limit…) are shown where the prompt was typed, so no toast here. */
export function useCreateFormWithAi() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: aiApi.createForm, onSuccess: (form) => storeForm(qc, form) });
}

export function useAddAiQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, prompt }: { id: number; prompt: string }) => aiApi.addQuestions(id, prompt),
    onSuccess: (form) => storeForm(qc, form),
  });
}

export function useRenameForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => formsApi.update(id, { title }),
    onMutate: ({ id, title }) => patchLists(qc, (list) => list.map((f) => (f.id === id ? { ...f, title } : f))),
    onSuccess: (form) => {
      storeForm(qc, form);
      toast.success("Form renamed");
    },
    onError: (error, _vars, rollback) => {
      rollback?.();
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormListItem) => formsApi.remove(form.id),
    onMutate: (form) => patchLists(qc, (list) => list.filter((f) => f.id !== form.id)),
    onSuccess: (_data, form) => {
      qc.removeQueries({ queryKey: formKeys.detail(form.id) });
      toast.success(`Deleted “${form.title}”`);
    },
    onError: (error, _form, rollback) => {
      rollback?.();
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDuplicateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormListItem) => formsApi.duplicate(form.id),
    onSuccess: (clone) => {
      storeForm(qc, clone);
      toast.success(`Created “${clone.title}”`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useSetPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) =>
      published ? formsApi.publish(id) : formsApi.unpublish(id),
    onSuccess: (form) => {
      storeForm(qc, form);
      toast.success(form.status === "published" ? "Form published" : "Form unpublished");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/** One form with its questions (results page). Always refetched when shown: the builder may have changed it. */
export function useForm(id: number) {
  return useQuery({
    queryKey: formKeys.detail(id),
    queryFn: () => formsApi.get(id),
    staleTime: 0,
    enabled: Number.isInteger(id),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  });
}

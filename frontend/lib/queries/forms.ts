"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import type { Form, FormCreate, FormListItem, FormUpdate } from "@/lib/types";

// ---- API ---------------------------------------------------------------

export const formsApi = {
  list: () => apiGet<FormListItem[]>("/forms"),
  get: (id: number) => apiGet<Form>(`/forms/${id}`),
  create: (data: FormCreate) => apiPost<Form>("/forms", data),
  update: (id: number, data: FormUpdate) => apiPatch<Form>(`/forms/${id}`, data),
  remove: (id: number) => apiDelete(`/forms/${id}`),
  duplicate: (id: number) => apiPost<Form>(`/forms/${id}/duplicate`),
  publish: (id: number) => apiPost<Form>(`/forms/${id}/publish`),
  unpublish: (id: number) => apiPost<Form>(`/forms/${id}/unpublish`),
};

export const formKeys = {
  all: ["forms"] as const,
  list: () => [...formKeys.all, "list"] as const,
  detail: (id: number) => [...formKeys.all, "detail", id] as const,
};

// ---- Helpers -----------------------------------------------------------

export function toListItem(form: Form): FormListItem {
  const { id, slug, title, status, response_count, created_at, updated_at, published_at } = form;
  return {
    id,
    slug,
    title,
    status,
    response_count,
    created_at,
    updated_at,
    published_at,
    question_count: form.questions.length,
  };
}

/** Writes a fresh server copy of a form into both the list and detail caches. */
function storeForm(qc: QueryClient, form: Form) {
  qc.setQueryData(formKeys.detail(form.id), form);
  qc.setQueryData<FormListItem[]>(formKeys.list(), (list) => {
    if (!list) return list;
    const item = toListItem(form);
    return list.some((f) => f.id === form.id) ? list.map((f) => (f.id === form.id ? item : f)) : [item, ...list];
  });
}

/** Optimistically edits the cached list; returns a rollback. */
async function patchList(qc: QueryClient, update: (list: FormListItem[]) => FormListItem[]) {
  await qc.cancelQueries({ queryKey: formKeys.list() });
  const previous = qc.getQueryData<FormListItem[]>(formKeys.list());
  if (previous) qc.setQueryData(formKeys.list(), update(previous));
  return () => qc.setQueryData(formKeys.list(), previous);
}

// ---- Hooks -------------------------------------------------------------

export function useForms() {
  // staleTime 0: the builder edits forms too, so refresh whenever the dashboard is shown.
  return useQuery({ queryKey: formKeys.list(), queryFn: formsApi.list, staleTime: 0 });
}

export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: formsApi.create,
    onSuccess: (form) => storeForm(qc, form),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRenameForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => formsApi.update(id, { title }),
    onMutate: ({ id, title }) => patchList(qc, (list) => list.map((f) => (f.id === id ? { ...f, title } : f))),
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
    onMutate: (form) => patchList(qc, (list) => list.filter((f) => f.id !== form.id)),
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

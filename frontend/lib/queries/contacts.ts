"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL, apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import type { ApiFilters, ContactSource, SubscriptionStatus } from "@/lib/contacts";
import { pluralize } from "@/lib/format";

export type ContactHistoryEntry = { status: SubscriptionStatus; at: string };

export type Contact = {
  id: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  subscription_status: SubscriptionStatus;
  subscription_history: ContactHistoryEntry[];
  sources: ContactSource[];
  last_update_source: string;
  created_at: string;
  updated_at: string;
};

export type ContactPage = { items: Contact[]; total: number };
export type ContactList = { id: number; name: string; filters: ApiFilters; count: number; created_at: string };

/** What the table is showing: the search box, applied filters, the open saved list and the sort. */
export type ContactsView = {
  query: string;
  filters: ApiFilters | null;
  listId: number | null;
  sort: string;
  order: "asc" | "desc";
};

/** Fields the add / edit dialog sends. Blank text clears a field. */
export type ContactInput = {
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  notes?: string;
  subscription_status?: Exclude<SubscriptionStatus, "suppressed">;
};

export type ImportResult = { created: number; updated: number; errors: { row: number; message: string }[] };

function params(view: ContactsView): URLSearchParams {
  const search = new URLSearchParams({ sort: view.sort, order: view.order });
  if (view.query.trim()) search.set("query", view.query.trim());
  if (view.filters) search.set("filters", JSON.stringify(view.filters));
  if (view.listId !== null) search.set("list_id", String(view.listId));
  return search;
}

export const contactsApi = {
  list: (view: ContactsView) => apiGet<ContactPage>(`/contacts?${params(view)}`),
  /** A link the browser can download: the same contacts the table shows. */
  exportUrl: (view: ContactsView) => `${API_URL}/contacts/export.csv?${params(view)}`,
  create: (data: ContactInput) => apiPost<Contact>("/contacts", data),
  update: (id: number, data: ContactInput) => apiPatch<Contact>(`/contacts/${id}`, data),
  remove: (id: number) => apiDelete(`/contacts/${id}`),
  bulkDelete: (ids: number[]) => apiPost<{ deleted: number }>("/contacts/bulk-delete", { ids }),
  importRows: (rows: Record<string, string>[]) => apiPost<ImportResult>("/contacts/import", { rows }),
  sync: () => apiPost<{ created: number; updated: number }>("/contacts/sync"),
  lists: () => apiGet<ContactList[]>("/contacts/lists"),
  createList: (name: string, filters: ApiFilters) => apiPost<ContactList>("/contacts/lists", { name, filters }),
  updateList: (id: number, data: { name?: string; filters?: ApiFilters }) => apiPatch<ContactList>(`/contacts/lists/${id}`, data),
  removeList: (id: number) => apiDelete(`/contacts/lists/${id}`),
};

export const contactKeys = {
  all: ["contacts"] as const,
  list: (view: ContactsView) => [...contactKeys.all, "table", view] as const,
  lists: ["contacts", "lists"] as const,
};

/** The contacts for a view. Keeps the old rows on screen while a new search or sort loads. */
export function useContacts(view: ContactsView) {
  return useQuery({ queryKey: contactKeys.list(view), queryFn: () => contactsApi.list(view), placeholderData: keepPreviousData });
}

export function useContactLists() {
  return useQuery({ queryKey: contactKeys.lists, queryFn: contactsApi.lists });
}

/**
 * A mutation that refreshes every contacts query afterwards. Errors are toasted unless `quiet`, for callers (forms)
 * that show the server's field messages themselves.
 */
function useContactsMutation<V, R>(run: (v: V) => Promise<R>, { onDone, quiet }: { onDone?: (r: R, v: V) => string | void; quiet?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result, variables) => {
      const message = onDone?.(result, variables);
      if (message) toast.success(message);
      void qc.invalidateQueries({ queryKey: contactKeys.all });
    },
    onError: (error) => {
      if (!quiet) toast.error(getErrorMessage(error));
    },
  });
}

export const useCreateContact = () => useContactsMutation(contactsApi.create, { quiet: true, onDone: () => "Contact added" });

export const useUpdateContact = (options: { quiet?: boolean } = {}) =>
  useContactsMutation(({ id, data }: { id: number; data: ContactInput }) => contactsApi.update(id, data), options);

export const useDeleteContacts = () =>
  useContactsMutation(contactsApi.bulkDelete, { onDone: ({ deleted }) => `${pluralize(deleted, "contact")} deleted` });

export const useImportContacts = () => useContactsMutation(contactsApi.importRows, { quiet: true });

export const useAutoAddFromForms = () =>
  useContactsMutation(contactsApi.sync, {
    onDone: ({ created, updated }) =>
      created + updated === 0 ? "No new contacts found in your responses" : `Added ${pluralize(created, "contact")} from your forms`,
  });

export const useCreateList = () =>
  useContactsMutation(({ name, filters }: { name: string; filters: ApiFilters }) => contactsApi.createList(name, filters), {
    quiet: true,
    onDone: (list) => `List “${list.name}” created`,
  });

export const useUpdateList = () =>
  useContactsMutation(({ id, ...data }: { id: number; name?: string; filters?: ApiFilters }) => contactsApi.updateList(id, data), { quiet: true });

export const useDeleteList = () => useContactsMutation(contactsApi.removeList, { onDone: () => "List deleted" });

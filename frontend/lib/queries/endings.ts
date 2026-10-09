import { apiPost, apiPatch, apiDelete, apiPut } from "../api";
import type { Ending } from "../types";

export const endingsApi = {
  create: (formId: number, data: Partial<Ending>) => apiPost<Ending>(`/forms/${formId}/endings`, data),
  update: (id: number, data: Partial<Ending>) => apiPatch<Ending>(`/endings/${id}`, data),
  delete: (id: number) => apiDelete<void>(`/endings/${id}`),
  reorder: (formId: number, endingIds: number[]) => apiPut<Ending[]>(`/forms/${formId}/endings/order`, endingIds),
};

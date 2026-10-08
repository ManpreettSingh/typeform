import { apiDelete, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { Question, QuestionCreate, QuestionUpdate } from "@/lib/types";

export const questionsApi = {
  create: (formId: number, data: QuestionCreate) => apiPost<Question>(`/forms/${formId}/questions`, data),
  update: (id: number, data: QuestionUpdate) => apiPatch<Question>(`/questions/${id}`, data),
  remove: (id: number) => apiDelete(`/questions/${id}`),
  reorder: (formId: number, orderedIds: number[]) =>
    apiPut<Question[]>(`/forms/${formId}/questions/order`, { ordered_ids: orderedIds }),
};

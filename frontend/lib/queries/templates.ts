import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { Form } from "@/lib/types";

export type TemplateSummary = {
  slug: string;
  title: string;
  description: string;
  tags: {
    role: string[];
    goal: string[];
    type: string[];
  };
  question_count: number;
  question_types: string[];
  theme: string[];
  theme_name: string;
};

export type TemplateDetail = TemplateSummary & {
  questions: {
    type: string;
    title: string;
    description: string | null;
    required: boolean;
  }[];
  endings: {
    title: string;
  }[];
};

export const templatesApi = {
  list: (params?: Record<string, string | string[]>) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return apiGet<TemplateSummary[]>(`/templates${qs}`);
  },
  get: (slug: string) => apiGet<TemplateDetail>(`/templates/${slug}`),
  createForm: (slug: string, workspace_id?: number) => 
    apiPost<Form>(`/forms/from-template/${slug}`, workspace_id ? { workspace_id } : undefined),
};

export function useTemplates(params?: Record<string, string | string[]>) {
  return useQuery({
    queryKey: ["templates", params],
    queryFn: () => templatesApi.list(params),
  });
}

export function useTemplate(slug: string) {
  return useQuery({
    queryKey: ["templates", slug],
    queryFn: () => templatesApi.get(slug),
  });
}

export function useCreateFromTemplate() {
  return useMutation({
    mutationFn: ({ slug, workspace_id }: { slug: string; workspace_id?: number }) => 
      templatesApi.createForm(slug, workspace_id),
  });
}

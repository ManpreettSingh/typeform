import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

export type Workspace = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export const workspaceApi = {
  list: () => apiGet<Workspace[]>("/workspaces"),
  create: (name: string) => apiPost<Workspace>("/workspaces", { name }),
};

export function useWorkspaces() {
  return useQuery({ queryKey: ["workspaces"], queryFn: workspaceApi.list });
}

export function createWorkspace(name: string): Promise<Workspace> {
  return workspaceApi.create(name);
}

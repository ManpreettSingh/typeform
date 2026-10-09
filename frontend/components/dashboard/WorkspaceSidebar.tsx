"use client";

import { ChevronUp, LayoutGrid, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { ChatToCreateBar } from "@/components/ai/ChatToCreateBar";
import { useAiLauncher } from "@/lib/ai/launcher";
import { IconButton, Modal, Button, Input } from "@/components/ui";
import { CreateFormButton } from "./CreateFormButton";
import { useWorkspaces, createWorkspace } from "@/lib/queries/workspaces";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  formCount: number | null;
  /** Completed + in-progress responses across all forms, once loaded. */
  totals: { completed: number; inProgress: number } | null;
  activeWorkspace: number;
  setActiveWorkspace: (id: number) => void;
};

/** Typeform's left column: Create form, search, the workspace list and a responses footer. */
export function WorkspaceSidebar({ query, onQueryChange, formCount, totals, activeWorkspace, setActiveWorkspace }: Props) {
  const [privateOpen, setPrivateOpen] = useState(true);
  // "Ask Typeform AI": the review view for a form that doesn't exist yet; Apply creates it.
  const [ai, setAi] = useState<string | null>(null);
  const router = useRouter();
  const { data: workspaces } = useWorkspaces();
  // A request made elsewhere (the onboarding's "Create my first form with AI") opens the same view.
  const launched = useAiLauncher((s) => s.prompt);
  const clearLaunched = useAiLauncher((s) => s.clear);
  const aiPrompt = ai ?? launched;

  const [workspaceTitle, setWorkspaceTitle] = useState("");
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const formId = useId();
  const queryClient = useQueryClient();

  async function onCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceTitle.trim()) return;
    try {
      const ws = await createWorkspace(workspaceTitle.trim());
      setCreateWsOpen(false);
      setWorkspaceTitle("");
      setActiveWorkspace(ws.id);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <aside aria-label="Workspace" className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
        <div className="border-b border-border p-4">
          <CreateFormButton size="sm" className="w-full" activeWorkspace={activeWorkspace} />
        </div>
        <div className="border-b border-border p-4">
          <label className="flex h-8 items-center gap-2 rounded-input px-3 text-sm text-text-muted focus-within:bg-bg-hover">
            <Search className="size-4 shrink-0" aria-hidden />
            <input
              type="search"
              aria-label="Search forms"
              placeholder="Search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-text placeholder:text-text-muted focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center justify-between pl-3">
            <span className="flex items-center gap-2 text-sm font-medium text-text-soft">
              <LayoutGrid className="size-4" aria-hidden />
              Workspaces
            </span>
            <IconButton
              size="sm"
              label="New workspace"
              icon={<Plus className="size-4" />}
              onClick={() => setCreateWsOpen(true)}
              className="border border-border-strong bg-field hover:bg-bg-hover"
            />
          </div>
        <button
          type="button"
          aria-expanded={privateOpen}
          onClick={() => setPrivateOpen((open) => !open)}
          className="flex h-8 items-center justify-between rounded-input px-3 text-sm font-medium text-text-muted hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          Private
          <ChevronUp className={privateOpen ? "size-4" : "size-4 rotate-180"} aria-hidden />
        </button>
        {privateOpen &&
          (workspaces || [{ id: 1, name: "My workspace" }]).map((ws) => {
            const active = activeWorkspace === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 w-full items-center justify-between rounded-field px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  active ? "bg-bg-hover text-text" : "text-text-soft hover:bg-bg-hover/50 hover:text-text"
                }`}
              >
                {ws.name}
                {active && formCount !== null && <span className="text-xs text-text-soft">{formCount}</span>}
              </button>
            );
          })}
      </div>

      <div className="mt-auto border-t border-border p-4">
        <p className="text-sm text-text">Responses collected</p>
        {totals && (
          <p className="mt-1 text-base text-text">
            {totals.completed.toLocaleString("en")}{" "}
            <span className="text-xs text-text-muted">completed · {totals.inProgress.toLocaleString("en")} in progress</span>
          </p>
        )}
        <ChatToCreateBar label="Ask Typeform AI" onSubmit={setAi} className="mt-4" />
      </div>
      {aiPrompt !== null && (
        <AiAssistant
          formId={null}
          initialPrompt={aiPrompt}
          onClose={() => {
            setAi(null);
            clearLaunched();
          }}
          onApplied={(form) => {
            setAi(null);
            clearLaunched();
            router.push(`/forms/${form.id}/edit`);
          }}
        />
      )}
      </aside>
      
      <Modal
        open={createWsOpen}
        onClose={() => setCreateWsOpen(false)}
        title="Create a new workspace"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateWsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={formId}>
              Create
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={onCreateWorkspace}>
          <Input
            label="Workspace name"
            placeholder="e.g. Marketing"
            value={workspaceTitle}
            maxLength={200}
            onChange={(e) => setWorkspaceTitle(e.target.value)}
          />
        </form>
      </Modal>
    </>
  );
}

"use client";

import { ChevronUp, LayoutGrid, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { ChatToCreateBar } from "@/components/ai/ChatToCreateBar";
import { useAiLauncher } from "@/lib/ai/launcher";
import { IconButton } from "@/components/ui";
import { CreateFormButton } from "./CreateFormButton";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  formCount: number | null;
  /** Completed + in-progress responses across all forms, once loaded. */
  totals: { completed: number; inProgress: number } | null;
};

/** Typeform's left column: Create form, search, the workspace list and a responses footer. */
export function WorkspaceSidebar({ query, onQueryChange, formCount, totals }: Props) {
  const [privateOpen, setPrivateOpen] = useState(true);
  // "Ask Typeform AI": the review view for a form that doesn't exist yet; Apply creates it.
  const [ai, setAi] = useState<string | null>(null);
  const router = useRouter();
  // A request made elsewhere (the onboarding's "Create my first form with AI") opens the same view.
  const launched = useAiLauncher((s) => s.prompt);
  const clearLaunched = useAiLauncher((s) => s.clear);
  const aiPrompt = ai ?? launched;

  return (
    <aside aria-label="Workspace" className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
      <div className="border-b border-border p-4">
        <CreateFormButton size="sm" className="w-full" />
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
            label="New workspace (coming soon)"
            icon={<Plus className="size-4" />}
            disabled
            className="border border-border-strong bg-field"
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
        {privateOpen && (
          <span
            aria-current="page"
            className="flex h-10 items-center justify-between rounded-field bg-bg-hover px-3 text-sm text-text"
          >
            My workspace
            {formCount !== null && <span className="text-xs text-text-soft">{formCount}</span>}
          </span>
        )}
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
  );
}

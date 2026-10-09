"use client";

import { Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Skeleton } from "@/components/ui";
import { useTemplates, useCreateFromTemplate } from "@/lib/queries/templates";
import { toast } from "sonner";

export function TemplatesGallery({ workspaceId = 1 }: { workspaceId?: number }) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  
  const { data: templates, isLoading } = useTemplates(query ? { q: query } : undefined);
  const createForm = useCreateFromTemplate();

  const handleCreate = (slug: string) => {
    createForm.mutate(
      { slug, workspace_id: workspaceId },
      {
        onSuccess: (form) => {
          toast.success("Form created from template");
          router.push(`/forms/${form.id}/edit`);
        },
      }
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/forms"
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text"
          >
            <ArrowLeft className="size-4" />
            Back to workspace
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-lg font-medium text-text">Template Gallery</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar filters (simplified for now) */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border p-6 max-md:hidden">
          <h2 className="mb-4 text-sm font-semibold text-text">Categories</h2>
          <nav className="flex flex-col gap-2 text-sm text-text-muted">
            <button className="text-left hover:text-text" onClick={() => setQuery("")}>All templates</button>
            <button className="text-left hover:text-text" onClick={() => setQuery("feedback")}>Feedback</button>
            <button className="text-left hover:text-text" onClick={() => setQuery("registration")}>Registration</button>
            <button className="text-left hover:text-text" onClick={() => setQuery("research")}>Research</button>
          </nav>
        </aside>

        {/* Main gallery */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="mb-8 flex max-w-md items-center gap-3">
            <Input
              type="search"
              placeholder="Search templates..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="size-4" />}
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex h-64 flex-col rounded-xl border border-border p-4">
                  <Skeleton className="mb-4 h-32 w-full rounded-lg" />
                  <Skeleton className="mb-2 h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : templates?.length === 0 ? (
            <div className="py-20 text-center text-text-muted">
              No templates found for "{query}".
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates?.map((t) => (
                <div 
                  key={t.slug} 
                  className="group relative flex h-64 flex-col rounded-xl border border-border bg-white transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="mb-2 line-clamp-2 text-lg font-medium text-text">{t.title}</h3>
                    <p className="line-clamp-3 text-sm text-text-muted">{t.description}</p>
                    <div className="mt-auto pt-4 text-xs text-text-soft">
                      {t.question_count} questions
                    </div>
                  </div>
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/50 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Button 
                      variant="primary" 
                      loading={createForm.isPending}
                      onClick={() => handleCreate(t.slug)}
                    >
                      Use template
                    </Button>
                    <Link 
                      href={`/templates/${t.slug}/preview`}
                      className="text-sm font-medium text-white hover:underline"
                    >
                      Preview
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

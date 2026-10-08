import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <EmptyState
        icon={<FileQuestion className="size-6" aria-hidden />}
        title="Page not found"
        description="The link may be broken, or the page may have moved."
        action={
          <Link
            href="/forms"
            className="inline-flex h-10 items-center rounded-input bg-primary px-4 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Go to your forms
          </Link>
        }
      />
    </main>
  );
}

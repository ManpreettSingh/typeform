"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, EmptyState } from "@/components/ui";

/** Catches render errors below the root layout; the nav and providers stay up. */
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <EmptyState
        tone="danger"
        icon={<AlertTriangle className="size-6" aria-hidden />}
        title="Something went wrong"
        description="This page hit an unexpected error. Your saved work is safe."
        action={
          <div className="flex items-center gap-3">
            <Button onClick={() => retry()}>Try again</Button>
            <Link href="/forms" className="text-sm font-medium text-accent hover:underline">
              Back to your forms
            </Link>
          </div>
        }
      />
    </main>
  );
}

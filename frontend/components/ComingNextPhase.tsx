import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

/** Temporary stand-in for routes that later phases build out. */
export function ComingNextPhase({ title, phase }: { title: string; phase: number }) {
  return (
    <main className="flex flex-1 items-center justify-center">
      <EmptyState
        icon={<Construction className="size-6" />}
        title={`${title} is coming soon`}
        description={`This screen is built in Phase ${phase}.`}
        action={
          <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Back to workspace
          </Link>
        }
      />
    </main>
  );
}

import { Lock } from "lucide-react";
import { Badge, Button } from "@/components/ui";

/** Placeholder for features outside the assignment's scope. Clearly disabled. */
export function ComingSoonSection({ title, description }: { title: string; description: string }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 p-6 sm:p-10">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        <Badge variant="accent">Coming soon</Badge>
      </div>
      <p className="text-sm text-text-muted">{description}</p>
      <div
        aria-disabled="true"
        className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-bg-subtle px-6 py-12 text-center"
      >
        <Lock className="size-6 text-text-muted" aria-hidden />
        <p className="text-sm text-text-muted">This feature isn&rsquo;t available yet.</p>
        <Button size="sm" variant="secondary" disabled>
          Set up {title.toLowerCase()}
        </Button>
      </div>
    </section>
  );
}

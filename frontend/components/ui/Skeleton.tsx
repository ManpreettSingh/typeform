import { clsx } from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-shimmer rounded-input bg-bg-hover", className)} />;
}

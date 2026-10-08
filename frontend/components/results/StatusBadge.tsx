import { Badge } from "@/components/ui";
import type { ResponseStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ResponseStatus }) {
  return status === "completed" ? <Badge variant="success">Completed</Badge> : <Badge>Partial</Badge>;
}

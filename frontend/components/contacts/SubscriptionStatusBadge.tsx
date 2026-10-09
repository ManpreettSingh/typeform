import { clsx } from "clsx";
import { Ban, Mail, MailCheck, MailMinus, type LucideIcon } from "lucide-react";
import { SUBSCRIPTION_LABELS, type SubscriptionStatus } from "@/lib/contacts";

const LOOK: Record<SubscriptionStatus, { icon: LucideIcon; tone: string }> = {
  subscribed: { icon: MailCheck, tone: "text-success" },
  unsubscribed: { icon: MailMinus, tone: "text-text-muted" },
  never_subscribed: { icon: Mail, tone: "text-text-muted" },
  suppressed: { icon: Ban, tone: "text-danger" },
};

/** Typeform's subscription status: a small mail icon, readable at a glance, with its name. */
export function SubscriptionStatusBadge({ status, iconOnly = false }: { status: SubscriptionStatus; iconOnly?: boolean }) {
  const { icon: Icon, tone } = LOOK[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className={clsx("size-4 shrink-0", tone)} aria-hidden />
      {iconOnly ? <span className="sr-only">{SUBSCRIPTION_LABELS[status]}</span> : SUBSCRIPTION_LABELS[status]}
    </span>
  );
}

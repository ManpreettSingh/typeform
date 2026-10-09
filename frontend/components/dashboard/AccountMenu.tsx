"use client";

import { clsx } from "clsx";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Menu } from "@/components/ui";
import { avatarInitials, avatarLetter, displayName, type OnboardingState } from "@/lib/onboarding";
import { onboardingStore, useOnboarding, type OnboardingSnapshot } from "@/lib/useOnboarding";

// Until localStorage has been read the real name is unknown: keep the space, show nothing (no wrong-name flash).
const settled = (state: OnboardingSnapshot): OnboardingState => (state.status === "loading" ? { status: "unseen" } : state);

/** The account square and name from the visitor's onboarding profile ("Default creator" when there is none). */
export function AccountChip({ state }: { state: OnboardingSnapshot }) {
  const hidden = state.status === "loading";
  const s = settled(state);
  return (
    <>
      <span
        className={clsx(
          "flex size-8 items-center justify-center rounded-field bg-account text-[15px] text-account-fg",
          hidden && "invisible",
        )}
      >
        {avatarLetter(s)}
      </span>
      <span className={clsx("hidden max-w-44 truncate sm:inline", hidden && "invisible")}>{displayName(s)}</span>
      <ChevronDown className="size-4 text-text-muted" aria-hidden />
    </>
  );
}

/** The small round initials at the right end of the top bar. */
export function AccountInitials({ state }: { state: OnboardingSnapshot }) {
  const s = settled(state);
  return (
    <span
      title={displayName(s)}
      className={clsx(
        "flex size-8 items-center justify-center rounded-pill bg-thumb-4 text-xs font-semibold text-thumb-fg",
        state.status === "loading" && "invisible",
      )}
    >
      {avatarInitials(s)}
    </span>
  );
}

/** The account chip is a menu: this is where the intro can be shown again (handy for demos). */
export function AccountMenu() {
  const state = useOnboarding();
  return (
    <Menu
      align="start"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-input py-1 pr-2 pl-1 text-sm font-medium text-text-soft transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          <AccountChip state={state} />
        </button>
      )}
      items={[
        {
          label: "Restart intro",
          description: "Show the welcome questions again",
          icon: <RotateCcw className="size-4" aria-hidden />,
          onSelect: () => onboardingStore.reset(),
        },
      ]}
    />
  );
}

export function AccountInitialsBadge() {
  return <AccountInitials state={useOnboarding()} />;
}

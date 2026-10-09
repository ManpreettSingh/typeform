"use client";

import { useSyncExternalStore } from "react";
import { createOnboardingStore, type OnboardingState } from "@/lib/onboarding";

/** One store per tab. Storage is read lazily, so importing this on the server touches nothing. */
export const onboardingStore = createOnboardingStore(() => window.localStorage, {
  addStorageListener: (listener) => {
    const onStorage = (event: StorageEvent) => listener({ key: event.key });
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
});

const LOADING = { status: "loading" } as const;
export type OnboardingSnapshot = OnboardingState | typeof LOADING;

/**
 * The visitor's onboarding state. `loading` on the server and during hydration (localStorage isn't known yet), so
 * nothing flashes in or out; afterwards it is `unseen`, `skipped` or `completed`.
 */
export function useOnboarding(): OnboardingSnapshot {
  return useSyncExternalStore<OnboardingSnapshot>(onboardingStore.subscribe, onboardingStore.get, () => LOADING);
}

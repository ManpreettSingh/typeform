"use client";

import { useState } from "react";
import { useAiLauncher } from "@/lib/ai/launcher";
import { onboardingStore, useOnboarding } from "@/lib/useOnboarding";
import { OnboardingExperience } from "./OnboardingExperience";

/**
 * Shows the intro to a first-time visitor and never again: finishing or skipping saves a note in localStorage.
 * Lives in the workspace shell only, so people answering a shared form never see it.
 */
export function OnboardingGate() {
  const state = useOnboarding();
  // Saving the profile flips the state to "completed"; the closing screen must stay until the visitor leaves it.
  const [onClosingScreen, setOnClosingScreen] = useState(false);
  const launchAi = useAiLauncher((s) => s.launch);

  if (state.status !== "unseen" && !onClosingScreen) return null;

  return (
    <OnboardingExperience
      onFinish={(profile) => {
        setOnClosingScreen(true);
        onboardingStore.set(profile);
      }}
      onSkip={() => onboardingStore.set({ status: "skipped", completedAt: new Date().toISOString() })}
      onClose={() => setOnClosingScreen(false)}
      onCreateWithAi={(prompt) => {
        launchAi(prompt);
        setOnClosingScreen(false);
      }}
    />
  );
}

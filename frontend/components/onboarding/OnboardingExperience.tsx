"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useState } from "react";
import { RespondentFlow } from "@/components/respondent/RespondentFlow";
import { RespondentTheme } from "@/components/respondent/RespondentTheme";
import { completedProfile, type SavedOnboarding } from "@/lib/onboarding";
import { clearOnboardingPending, isOnboardingPending } from "@/lib/onboardingScript";
import type { Answers } from "@/lib/types";
import { OnboardingDone } from "./OnboardingDone";
import { ONBOARDING_QUESTIONS, ONBOARDING_THEME, ONBOARDING_WELCOME, Q_GOALS, Q_NAME, Q_ROLE } from "./onboardingQuestions";

const NO_ENDING = { title: "", message: "", button_text: null, button_url: null };

/** The answers of the intro as a profile (the engine already validated them; this normalizes). */
export function profileFromAnswers(answers: Answers): SavedOnboarding {
  const name = answers[Q_NAME];
  const role = answers[Q_ROLE];
  const goals = answers[Q_GOALS];
  return completedProfile({
    name: typeof name === "string" ? name : "",
    role: typeof role === "string" ? role : null,
    goals: Array.isArray(goals) ? goals.filter((g): g is string => typeof g === "string") : [],
  });
}

/**
 * The full-screen first-visit intro. It is a real form run by the respondent engine, on a dark theme with two drifting
 * glows behind it, ending in a personalized closing screen.
 */
export function OnboardingExperience({
  onFinish,
  onSkip,
  onClose,
  onCreateWithAi,
}: {
  /** The questions are answered: save the profile (the intro stays open on its closing screen). */
  onFinish: (profile: SavedOnboarding) => void;
  onSkip: () => void;
  /** Leave the closing screen. */
  onClose: () => void;
  onCreateWithAi: (prompt: string) => void;
}) {
  const reduced = useReducedMotion();
  const [profile, setProfile] = useState<SavedOnboarding | null>(null);
  // A first-time visitor arrives with the dashboard already hidden behind the intro's colour, so the intro appears
  // at once instead of fading in over it. Replayed from the account menu, it fades in over the dashboard as before.
  const [arrivedHidden] = useState(isOnboardingPending);

  // Opaque and in place: the dashboard may be shown behind it again.
  useLayoutEffect(() => {
    clearOnboardingPending();
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function onComplete(answers: Answers) {
    const done = profileFromAnswers(answers);
    setProfile(done);
    onFinish(done);
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      initial={arrivedHidden ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="fixed inset-0 z-[60] overflow-hidden bg-[#1d1722]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="onboarding-glow-a absolute -top-1/4 -left-1/6 size-[70vmax] rounded-full bg-[#ddb7f0]/20 blur-[120px]" />
        <div className="onboarding-glow-b absolute -right-1/6 -bottom-1/3 size-[60vmax] rounded-full bg-[#7a4fa3]/25 blur-[130px]" />
      </div>

      <RespondentTheme theme={ONBOARDING_THEME} className="relative h-full bg-transparent!">
        {profile ? (
          <OnboardingDone profile={profile} onCreateWithAi={onCreateWithAi} onExplore={onClose} />
        ) : (
          <RespondentFlow
            questions={ONBOARDING_QUESTIONS}
            welcome={ONBOARDING_WELCOME}
            thankYou={NO_ENDING}
            onComplete={onComplete}
          />
        )}
      </RespondentTheme>

      {!profile && (
        <button
          type="button"
          onClick={onSkip}
          className="absolute top-4 right-4 z-10 rounded-input px-3 py-1.5 text-sm text-[#e7d3f3]/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ddb7f0]"
        >
          Skip for now
        </button>
      )}
    </motion.div>
  );
}

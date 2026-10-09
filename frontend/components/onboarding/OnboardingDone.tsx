"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Sparkles } from "lucide-react";
import { GOALS, ROLES, suggestedPrompt, type SavedOnboarding } from "@/lib/onboarding";

/** The closing screen: a drawn check, a greeting by name, what we picked up, and a ready-made first request for the AI. */
export function OnboardingDone({
  profile,
  onCreateWithAi,
  onExplore,
}: {
  profile: SavedOnboarding;
  onCreateWithAi: (prompt: string) => void;
  onExplore: () => void;
}) {
  const reduced = useReducedMotion();
  const completed = profile.status === "completed" ? profile : null;
  const firstName = completed?.name.split(" ")[0];
  const prompt = suggestedPrompt(profile);
  const labels: (string | undefined)[] = [
    ROLES.find((r) => r.id === completed?.role)?.label,
    ...(completed?.goals.map((id) => GOALS.find((g) => g.id === id)?.label) ?? []),
  ];
  const tags = labels.filter((t): t is string => Boolean(t));

  const container: Variants = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.11, delayChildren: reduced ? 0 : 0.15 } } };
  const item: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.5, ease: [0.23, 1, 0.32, 1] } },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <motion.span variants={item} className="flex size-16 items-center justify-center rounded-full border border-resp-accent/50 bg-resp-accent/10 text-resp-accent">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : 0.35, ease: "easeOut" }}
          />
        </svg>
      </motion.span>

      <motion.h1 variants={item} className="text-3xl leading-tight break-words sm:text-4xl">
        {firstName ? `You're all set, ${firstName}!` : "You're all set!"}
      </motion.h1>
      <motion.p variants={item} className="text-lg opacity-70">
        Your workspace is ready. Here&rsquo;s a head start.
      </motion.p>

      {tags.length > 0 && (
        <motion.ul variants={item} className="flex flex-wrap justify-center gap-2" aria-label="What you told us">
          {tags.map((t) => (
            <li key={t} className="rounded-pill border border-resp-accent/40 px-3 py-1 text-sm text-resp-answer">
              {t}
            </li>
          ))}
        </motion.ul>
      )}

      <motion.div variants={item} className="w-full rounded-xl border border-resp-accent/40 bg-resp-accent/10 p-4 text-left">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-resp-accent uppercase">
          <Sparkles className="size-3.5" aria-hidden /> Typeform AI suggests
        </p>
        <p className="mt-1.5 text-lg leading-snug">&ldquo;{prompt}&rdquo;</p>
      </motion.div>

      <motion.div variants={item} className="mt-1 flex flex-col items-center gap-3 sm:flex-row">
        <button
          type="button"
          autoFocus
          onClick={() => onCreateWithAi(prompt)}
          className="rounded-resp-button bg-resp-accent px-5 py-2.5 text-lg font-semibold text-resp-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent"
        >
          Create my first form with AI
        </button>
        <button
          type="button"
          onClick={onExplore}
          className="rounded-resp-button px-4 py-2.5 text-lg text-resp-answer transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent"
        >
          Explore my workspace
        </button>
      </motion.div>
    </motion.div>
  );
}

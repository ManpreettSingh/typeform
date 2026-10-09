"use client";

import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { Flag, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { QuestionTypeChip } from "@/components/builder/QuestionTypeChip";
import { changeLabel } from "@/lib/ai/preview";
import { isEmptyDiff } from "@/lib/ai/session";
import type { Diff } from "@/lib/ai/types";

const words = (field: string) => field.replace(/_/g, " ");

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Each suggestion lands a beat after the one above it, so a new form builds up question by question.
const STAGGER_S = 0.09;
const MAX_DELAY_S = 1.6;

/** "Suggested changes": what Apply would do, as Typeform's review list shows it (removed items, then items to be set). */
export function SuggestedChanges({ diff, versionKey = 0 }: { diff: Diff | null; /** A new key replays the reveal (a new proposal). */ versionKey?: number }) {
  const reduceMotion = useReducedMotion();
  // Rows are numbered in the order they are drawn, top to bottom across sections.
  let drawn = 0;
  const reveal = () => {
    const index = drawn++;
    return reduceMotion ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: Math.min(index * STAGGER_S, MAX_DELAY_S), ease: EASE_OUT } };
  };

  if (!diff) {
    return (
      <Empty title="No suggestions yet" text="Tell Typeform AI what you want in the chat. Its suggestions will show up here for you to review." />
    );
  }
  if (isEmptyDiff(diff)) {
    return <Empty title="Nothing to change" text="Your form already matches this version. Ask for something else in the chat." />;
  }

  return (
    <div key={versionKey} className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-6 py-6">
      {diff.welcome.length > 0 && (
        <Section title="Welcome screen" count={diff.welcome.length}>
          <motion.li {...reveal()} className="flex items-center gap-3 rounded-field bg-bg px-3 py-2.5 text-sm text-text">
            <span className="flex h-6 items-center rounded-input bg-qt-screen px-1.5 text-qt-fg">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <span>
              Changed: <span className="text-text-muted">{diff.welcome.map(words).join(", ")}</span>
            </span>
          </motion.li>
        </Section>
      )}

      {diff.to_remove.length > 0 && (
        <Section title="Questions to be removed" count={diff.to_remove.length}>
          {diff.to_remove.map((q) => (
            <Row key={`r-${q.id}`} motionProps={reveal()} chip={<QuestionTypeChip type={q.type} />} title={q.title} caption="Removed" muted />
          ))}
        </Section>
      )}

      {diff.to_set.length > 0 && (
        <Section title="Questions to be set" count={diff.to_set.length}>
          {diff.to_set.map((q, i) => (
            <Row key={`s-${q.id ?? `new${i}`}`} motionProps={reveal()} chip={<QuestionTypeChip type={q.type} />} title={q.title} caption={changeLabel(q)} order={q.position + 1} />
          ))}
        </Section>
      )}

      {diff.endings.to_remove.length > 0 && (
        <Section title="Endings to be removed" count={diff.endings.to_remove.length}>
          {diff.endings.to_remove.map((e) => (
            <Row key={`er-${e.id}`} motionProps={reveal()} chip={<EndingChip />} title={e.title} caption="Removed" muted />
          ))}
        </Section>
      )}

      {diff.endings.to_set.length > 0 && (
        <Section title="Endings to be set" count={diff.endings.to_set.length}>
          {diff.endings.to_set.map((e, i) => (
            <Row key={`es-${e.id ?? `new${i}`}`} motionProps={reveal()} chip={<EndingChip />} title={e.title} caption={changeLabel(e)} />
          ))}
        </Section>
      )}
    </div>
  );
}

function EndingChip() {
  return (
    <span className="flex h-6 items-center rounded-input bg-qt-screen px-1.5 text-qt-fg">
      <Flag className="size-3.5" aria-hidden />
    </span>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
        {title}
        <span className="rounded-pill bg-bg-hover px-1.5 text-xs font-medium text-text-muted">{count}</span>
      </h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

function Row({
  chip,
  title,
  caption,
  order,
  muted = false,
  motionProps,
}: {
  chip: ReactNode;
  title: string;
  caption: string;
  order?: number;
  muted?: boolean;
  motionProps: MotionProps;
}) {
  return (
    <motion.li {...motionProps} className="flex items-center gap-3 rounded-field bg-bg px-3 py-2.5">
      {chip}
      {order !== undefined && <span className="w-4 text-right text-xs text-text-muted tabular-nums">{order}</span>}
      <span className={muted ? "min-w-0 flex-1 truncate text-sm text-text-muted line-through" : "min-w-0 flex-1 truncate text-sm text-text"}>
        {title.trim() || "Untitled question"}
      </span>
      <span className="shrink-0 text-xs text-text-muted">{caption}</span>
    </motion.li>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border border-ai-line bg-ai-halo text-text-muted">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <p className="text-base font-medium text-text">{title}</p>
      <p className="max-w-[320px] text-sm text-text-muted">{text}</p>
    </div>
  );
}

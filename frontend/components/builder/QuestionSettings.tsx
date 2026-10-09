"use client";

import { clsx } from "clsx";
import { Minus, MousePointerClick, Plus, RefreshCw, Trash2, Video } from "lucide-react";
import { useState, type ComponentType } from "react";
import { SETTINGS_COMPONENTS } from "@/components/questionTypes/settings";
import { Button, EmptyState, IconButton } from "@/components/ui";
import { QUESTION_TYPE_META, getDef } from "@/lib/questionTypes";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { LogicSettings } from "./logic/LogicSettings";
import { PanelCard, PanelDivider, SwitchRow } from "./panel/PanelCard";
import { QuestionTypeChip } from "./QuestionTypeChip";
import { AnswerTypeSelect } from "./settings/AnswerTypeSelect";
import { MediaSettings } from "./settings/MediaSettings";
import { VideoQuestionDialog } from "./settings/VideoQuestionDialog";

/**
 * Right panel for the selected question, laid out like Typeform's: a Question card, an Answer card (type,
 * Required, type-specific switches) and a Logic card. Title, description and choices are edited on the canvas.
 */
export function QuestionSettings({ onDelete }: { onDelete: (question: Question) => void }) {
  const question = useBuilderStore((s) => s.questions.find((q) => q.id === s.selectedId));

  if (!question) {
    return (
      <PanelCard>
        <EmptyState
          className="py-8"
          icon={<MousePointerClick className="size-6" />}
          title="No question selected"
          description="Pick a question on the left, or add content."
        />
      </PanelCard>
    );
  }
  // Keyed so per-editor local state (e.g. half-typed numbers) resets between questions.
  return <Fields key={question.id} question={question} onDelete={onDelete} />;
}

function Fields({ question, onDelete }: { question: Question; onDelete: (question: Question) => void }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const answerable = getDef(question.type).answerable;

  return (
    <div className="flex flex-col gap-3">
      <PanelCard title="Question">
        <QuestionFormat question={question} />
      </PanelCard>

      <PanelCard title="Answer">
        {question.type === "group" || question.type === "statement" ? (
          <div
            title="The answer type is set when the question is added"
            className="flex h-9 items-center gap-2.5 rounded-field border border-border-strong bg-field px-1.5 text-sm text-text"
          >
            <QuestionTypeChip type={question.type} />
            {QUESTION_TYPE_META[question.type].label}
          </div>
        ) : (
          <AnswerTypeSelect question={question} />
        )}
        <PanelDivider />
        {answerable && (
          <SwitchRow
            label="Required"
            checked={question.required || Boolean(getDef(question.type).alwaysRequired)}
            disabled={getDef(question.type).alwaysRequired}
            onChange={(required) => updateQuestion(question.id, { required }, 0)}
          />
        )}
        <TypeSettings question={question} />
        <PanelDivider />
        {/* Like Typeform, the image settings sit at the end of the Answer card. */}
        <MediaSettings
          media={question.properties}
          onChange={(patch) => updateQuestion(question.id, { properties: { ...question.properties, ...patch } })}
        />
        <PanelDivider />
        <Button
          variant="dangerGhost"
          size="sm"
          className="-ml-2"
          leftIcon={<Trash2 className="size-4" aria-hidden />}
          onClick={() => onDelete(question)}
        >
          Delete question
        </Button>
      </PanelCard>

      {answerable && <LogicSettings question={question} />}
    </div>
  );
}

/**
 * Typeform's Text / Video switch. Video makes the creator's video the question (shown above it); switching back to
 * Text keeps the video, so a mis-click doesn't lose a recording.
 */
function QuestionFormat({ question }: { question: Question }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const [adding, setAdding] = useState(false);
  const isVideo = Boolean(question.properties.video_question);
  const set = (patch: Partial<Question["properties"]>) =>
    updateQuestion(question.id, { properties: { ...question.properties, ...patch } }, 0);

  const option = (video: boolean, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      aria-pressed={isVideo === video}
      onClick={() => set({ video_question: video || null })}
      className={clsx(
        "flex h-8 items-center justify-center gap-2 rounded-input text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent",
        isVideo === video ? "bg-bg text-text shadow-sm" : "text-text-muted hover:text-text",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <div role="group" aria-label="Question format" className="grid grid-cols-2 rounded-field bg-bg-hover p-0.5">
        {option(false, <Minus className="size-4" aria-hidden />, "Text")}
        {option(true, <Video className="size-4" aria-hidden />, "Video")}
      </div>
      {isVideo && (
        <div className="mt-2 flex min-h-10 items-center justify-between gap-2 text-sm text-text-muted">
          <span>{question.properties.video ? "Video" : "Add video"}</span>
          {question.properties.video ? (
            <div className="flex items-center">
              <IconButton size="sm" label="Change video" icon={<RefreshCw className="size-4" />} onClick={() => setAdding(true)} />
              <IconButton size="sm" label="Remove video" icon={<Trash2 className="size-4" />} onClick={() => set({ video: null })} />
            </div>
          ) : (
            <IconButton size="sm" label="Add video" icon={<Plus className="size-4" />} onClick={() => setAdding(true)} />
          )}
        </div>
      )}
      <VideoQuestionDialog open={adding} onClose={() => setAdding(false)} onDone={(video) => set({ video, video_question: true })} />
    </>
  );
}

function TypeSettings({ question }: { question: Question }) {
  // components/questionTypes/settings.ts guarantees every type has an entry (null = no extra settings).
  const Settings = SETTINGS_COMPONENTS[question.type] as unknown as ComponentType<{ question: Question }> | null;
  return Settings ? <Settings question={question} /> : null;
}

/** Welcome screen panel: what it is and when respondents see it. */
export function WelcomeSettings() {
  const hasDescription = useBuilderStore((s) => Boolean(s.form?.description?.trim()));
  return (
    <PanelCard title="Welcome Screen">
      <p className="text-sm text-text-muted">
        Edit the title and description on the canvas. The title is also your form&rsquo;s name.
      </p>
      <PanelDivider />
      <p className="text-sm text-text-muted">
        {hasDescription
          ? "Respondents see this screen before question 1, with a Start button."
          : "Hidden until it has a description: respondents start on question 1."}
      </p>
    </PanelCard>
  );
}

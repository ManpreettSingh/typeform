"use client";

import { Minus, MousePointerClick, Trash2, Video } from "lucide-react";
import type { ComponentType } from "react";
import { SETTINGS_COMPONENTS } from "@/components/questionTypes/settings";
import { Button, EmptyState } from "@/components/ui";
import { QUESTION_TYPE_META, getDef } from "@/lib/questionTypes";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { LogicSettings } from "./logic/LogicSettings";
import { PanelCard, PanelDivider, SwitchRow } from "./panel/PanelCard";
import { QuestionTypeChip } from "./QuestionTypeChip";
import { AnswerTypeSelect } from "./settings/AnswerTypeSelect";
import { MediaSettings } from "./settings/MediaSettings";

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
        <div role="group" aria-label="Question format" className="grid grid-cols-2 rounded-field bg-bg-hover p-0.5">
          <span className="flex h-8 items-center justify-center gap-2 rounded-input bg-bg text-sm text-text-soft shadow-sm">
            <Minus className="size-4" aria-hidden />
            Text
          </span>
          <span
            aria-disabled="true"
            title="Video questions are coming soon"
            className="flex h-8 cursor-default items-center justify-center gap-2 text-sm text-text-muted"
          >
            <Video className="size-4" aria-hidden />
            Video
          </span>
        </div>
      </PanelCard>

      <PanelCard title="Image or video">
        <MediaSettings
          attachment={question.properties.attachment}
          layout={question.properties.layout}
          onChange={(patch) =>
            updateQuestion(question.id, {
              properties: { ...question.properties, ...patch },
            })
          }
        />
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
            checked={question.required}
            onChange={(required) => updateQuestion(question.id, { required }, 0)}
          />
        )}
        <TypeSettings question={question} />
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

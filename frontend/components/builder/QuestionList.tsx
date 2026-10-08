"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import { CopyPlus, GalleryVertical, GitBranch, GripVertical, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, Menu } from "@/components/ui";
import { QUESTION_TYPE_META } from "@/lib/questionTypes";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

type Props = { onDelete: (question: Question) => void; onAddContent: () => void };

/**
 * Typeform's "Pages" panel: the welcome screen, then every question as a colored type tag with its number,
 * drag to reorder (handle or keyboard), ⋮ for duplicate / delete, and "Add content" at the bottom.
 */
export function QuestionList({ onDelete, onAddContent }: Props) {
  const questions = useBuilderStore((s) => s.questions);
  const screen = useBuilderStore((s) => s.screen);
  const showScreen = useBuilderStore((s) => s.showScreen);
  const moveQuestion = useBuilderStore((s) => s.moveQuestion);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    // A few px of movement before dragging, so clicks on the handle still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const positionOf = (id: UniqueIdentifier) => questions.findIndex((q) => q.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up question ${positionOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `Question ${positionOf(active.id)} is over position ${positionOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Question ${positionOf(active.id)} dropped at position ${positionOf(over.id)}.` : "Question dropped.",
    onDragCancel: ({ active }) => `Moving cancelled. Question ${positionOf(active.id)} stayed in place.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (over && active.id !== over.id) moveQuestion(Number(active.id), Number(over.id));
  }

  const active = questions.find((q) => q.id === activeId);

  return (
    <div className="flex flex-col gap-1 p-3">
      <h2 className="px-2 pt-1 pb-2 text-sm font-semibold text-text">Pages</h2>
      <button
        type="button"
        onClick={() => showScreen("welcome")}
        aria-current={screen === "welcome" ? "true" : undefined}
        className={clsx(
          "flex w-full items-center gap-2.5 rounded-field p-2 text-left text-sm text-text-soft focus-visible:outline-2 focus-visible:outline-accent",
          screen === "welcome" ? "bg-bg-hover" : "hover:bg-bg-hover/60",
        )}
      >
        <span className="flex h-6 items-center rounded-input bg-qt-screen px-1.5 text-qt-fg">
          <GalleryVertical className="size-3.5" aria-hidden />
        </span>
        Welcome screen
      </button>

      {questions.length > 0 && (
        <DndContext
          id="question-list"
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "To reorder, press Space or Enter to pick up the question, use the arrow keys to move it, " +
                "then press Space or Enter again to drop it, or Escape to cancel.",
            },
          }}
          onDragStart={({ active }: DragStartEvent) => setActiveId(Number(active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-0.5">
              {questions.map((q, i) => (
                <SortableQuestion key={q.id} question={q} number={i + 1} onDelete={onDelete} />
              ))}
            </ol>
          </SortableContext>
          <DragOverlay>
            {active && (
              <div className="rounded-field bg-bg shadow-popover">
                <QuestionRow question={active} number={positionOf(active.id)} selected />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <div className="mt-1 border-t border-border pt-2">
        <Button
          variant={questions.length ? "ghost" : "primary"}
          size="sm"
          className="w-full"
          leftIcon={<Plus className="size-4" aria-hidden />}
          onClick={onAddContent}
        >
          Add content
        </Button>
      </div>
    </div>
  );
}

function SortableQuestion({
  question,
  number,
  onDelete,
}: { question: Question; number: number } & Pick<Props, "onDelete">) {
  const selected = useBuilderStore((s) => s.screen === "question" && s.selectedId === question.id);
  const select = useBuilderStore((s) => s.select);
  const duplicateQuestion = useBuilderStore((s) => s.duplicateQuestion);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("group relative", isDragging && "opacity-40")}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder question ${number}`}
        className="absolute top-1/2 -left-3.5 z-10 flex h-7 w-4 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-input text-text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => select(question.id)}
        aria-current={selected ? "true" : undefined}
        className="w-full rounded-field text-left focus-visible:outline-2 focus-visible:outline-accent"
      >
        <QuestionRow question={question} number={number} selected={selected} />
      </button>
      <Menu
        className="!absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100"
        items={[
          {
            label: "Duplicate",
            icon: <CopyPlus className="size-4 text-text-muted" />,
            onSelect: () => void duplicateQuestion(question.id),
          },
          {
            label: "Delete",
            icon: <Trash2 className="size-4" />,
            danger: true,
            separatorBefore: true,
            onSelect: () => onDelete(question),
          },
        ]}
        trigger={(props) => (
          <IconButton
            {...props}
            size="sm"
            label={`Options for question ${number}`}
            icon={<MoreVertical className="size-4" />}
          />
        )}
      />
    </li>
  );
}

function QuestionRow({ question, number, selected }: { question: Question; number: number; selected: boolean }) {
  const { icon: Icon, chip, label } = QUESTION_TYPE_META[question.type];
  return (
    <span
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-field py-2 pr-9 pl-2 text-sm text-text-soft transition-colors",
        selected ? "bg-bg-hover" : "hover:bg-bg-hover/60",
      )}
    >
      {/* Typeform's page tag: the type's color, its icon and the question number. */}
      <span
        title={label}
        className={clsx("flex h-6 shrink-0 items-center gap-1 rounded-input px-1.5 text-xs font-medium", chip)}
      >
        <Icon className="size-3.5" aria-hidden />
        <span className="tabular-nums">{number}</span>
      </span>
      <span className={clsx("truncate", !question.title.trim() && "text-text-muted italic")}>
        {question.title.trim() || "Untitled question"}
      </span>
      {question.logic && (
        <span className="ml-auto shrink-0 text-text-muted" title="Has logic jumps">
          <GitBranch className="size-3.5" aria-label="Has logic jumps" />
        </span>
      )}
    </span>
  );
}

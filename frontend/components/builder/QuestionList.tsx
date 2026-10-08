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
import { GitBranch, GripVertical, ListPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState, IconButton } from "@/components/ui";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { AddQuestionMenu } from "./AddQuestionMenu";
import { QuestionTypeChip } from "./QuestionTypeChip";

type Props = { onDelete: (question: Question) => void };

export function QuestionList({ onDelete }: Props) {
  const questions = useBuilderStore((s) => s.questions);
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-text">
          Questions <span className="font-normal text-text-muted">({questions.length})</span>
        </h2>
        {questions.length > 0 && <AddQuestionMenu />}
      </div>

      {questions.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<ListPlus className="size-6" />}
          title="No questions yet"
          description="Add your first question to start building."
          action={<AddQuestionMenu variant="primary" />}
        />
      ) : (
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
            <ol className="flex flex-col gap-0.5 px-2 pb-4">
              {questions.map((q, i) => (
                <SortableQuestion key={q.id} question={q} number={i + 1} onDelete={onDelete} />
              ))}
            </ol>
          </SortableContext>
          <DragOverlay>
            {active && (
              <div className="rounded-input bg-bg shadow-popover">
                <QuestionRow question={active} number={positionOf(active.id)} selected />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function SortableQuestion({ question, number, onDelete }: { question: Question; number: number } & Props) {
  const selectedId = useBuilderStore((s) => s.selectedId);
  const select = useBuilderStore((s) => s.select);
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
        className="absolute top-1/2 left-0.5 z-10 flex h-7 w-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-input text-text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => select(question.id)}
        aria-current={question.id === selectedId ? "true" : undefined}
        className="w-full rounded-input text-left focus-visible:outline-2 focus-visible:outline-accent"
      >
        <QuestionRow question={question} number={number} selected={question.id === selectedId} />
      </button>
      <IconButton
        size="sm"
        label={`Delete question ${number}`}
        icon={<Trash2 className="size-3.5" />}
        onClick={() => onDelete(question)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
      />
    </li>
  );
}

function QuestionRow({ question, number, selected }: { question: Question; number: number; selected: boolean }) {
  return (
    <span
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-input py-2 pr-10 pl-6 text-sm text-text transition-colors",
        selected ? "bg-bg-hover" : "hover:bg-bg-subtle",
      )}
    >
      <span className="w-4 shrink-0 text-right text-xs text-text-muted tabular-nums">{number}</span>
      <QuestionTypeChip type={question.type} />
      <span className={clsx("truncate", !question.title.trim() && "text-text-muted italic")}>
        {question.title.trim() || "Untitled question"}
      </span>
      {question.required && (
        <span className="shrink-0 text-text-muted" aria-label="Required">
          *
        </span>
      )}
      {question.logic && (
        <span className="ml-auto shrink-0 text-text-muted" title="Has logic jumps">
          <GitBranch className="size-3.5" aria-label="Has logic jumps" />
        </span>
      )}
    </span>
  );
}

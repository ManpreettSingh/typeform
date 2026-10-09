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
import { CopyPlus, GalleryVertical, GitBranch, GripVertical, MoreVertical, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, Menu } from "@/components/ui";
import { QUESTION_TYPE_META } from "@/lib/questionTypes";
import type { Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { EndingsCard } from "./EndingsCard";

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
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

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
    if (!over || active.id === over.id) return;
    const activeNum = Number(active.id);
    const overNum = Number(over.id);
    
    // We just moved a question. Check its new position in the array.
    const from = questions.findIndex((q) => q.id === activeNum);
    const to = questions.findIndex((q) => q.id === overNum);
    
    // Create hypothetical next array
    const nextQuestions = [...questions];
    const [moved] = nextQuestions.splice(from, 1);
    nextQuestions.splice(to, 0, moved);
    
    let newGroupId: number | null = null;
    
    // Find if the new position is inside a group
    for (let i = to - 1; i >= 0; i--) {
      if (nextQuestions[i].type === "group") {
        // If we found a group header above it, check if we are inside it.
        // It's inside if the item immediately above it is either the group header itself or a child of it.
        if (i === to - 1 || nextQuestions[to - 1].group_id === nextQuestions[i].id) {
          newGroupId = nextQuestions[i].id;
        }
        break;
      }
    }

    moveQuestion(activeNum, overNum);

    // If group changed, update it.
    if (moved.group_id !== newGroupId && moved.type !== "group") {
      updateQuestion(activeNum, { group_id: newGroupId });
    }
  }

  const active = questions.find((q) => q.id === activeId);

  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <h2 className="text-sm font-semibold text-text">Pages</h2>
        <button disabled className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-text-muted hover:bg-bg-hover disabled:opacity-50">
          Universal mode
          <ChevronDown className="size-3" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        onClick={() => showScreen("welcome")}
        aria-current={screen === "welcome" ? "true" : undefined}
        className={clsx(
          "flex w-full items-center gap-2.5 rounded-[12px] p-2 text-left text-sm text-text-soft transition-colors",
          screen === "welcome"
            ? "bg-bg-hover shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)]"
            : "bg-bg hover:bg-bg-hover shadow-[0_0_0_1px_rgba(0,0,0,0.05)]",
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
              {questions.map((q, i) => {
                const isGroupChild = q.group_id !== null;
                const isCollapsed = isGroupChild && collapsedGroups.has(q.group_id!);
                if (isCollapsed) return null;
                
                return (
                  <SortableQuestion
                    key={q.id}
                    question={q}
                    number={i + 1}
                    onDelete={(q) => {
                      if (q.type === "group") {
                        const childrenCount = questions.filter(child => child.group_id === q.id).length;
                        if (childrenCount > 0) {
                          if (confirm(`Delete ${childrenCount} questions too?`)) {
                            onDelete(q);
                          }
                        } else {
                          onDelete(q);
                        }
                      } else {
                        onDelete(q);
                      }
                    }}
                    onToggleCollapse={() => {
                      if (q.type === "group") {
                        setCollapsedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(q.id)) next.delete(q.id);
                          else next.add(q.id);
                          return next;
                        });
                      }
                    }}
                    isCollapsed={collapsedGroups.has(q.id)}
                  />
                );
              })}
            </ol>
          </SortableContext>
          <DragOverlay>
            {active && (
              <div className="rounded-[12px] bg-bg shadow-popover">
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
      <div className="mt-1 flex justify-center py-2">
        <div className="h-1 w-8 rounded-full bg-border hover:bg-text-muted cursor-ns-resize transition-colors" />
      </div>
      
      <div className="mt-2">
        <EndingsCard />
      </div>
    </div>
  );
}

function SortableQuestion({
  question,
  number,
  onDelete,
  onToggleCollapse,
  isCollapsed
}: { 
  question: Question; 
  number: number;
  onToggleCollapse: () => void;
  isCollapsed: boolean;
} & Pick<Props, "onDelete">) {
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
      <div className={clsx("w-full flex items-center", question.group_id !== null && "pl-4")}>
        {question.type === "group" && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }} className="mr-1 text-text-muted hover:text-text-soft">
            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => select(question.id)}
          aria-current={selected ? "true" : undefined}
          className="flex-1 rounded-field text-left focus-visible:outline-2 focus-visible:outline-accent min-w-0"
        >
          <QuestionRow question={question} number={number} selected={selected} />
        </button>
      </div>
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
        "flex w-full items-center gap-2.5 rounded-[12px] py-2 pr-9 pl-2 text-sm text-text-soft transition-colors",
        selected ? "bg-bg-hover shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)]" : "bg-bg hover:bg-bg-hover shadow-[0_0_0_1px_rgba(0,0,0,0.05)]",
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

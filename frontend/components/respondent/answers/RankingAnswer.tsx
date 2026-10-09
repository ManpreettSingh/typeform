"use client";

import { useEffect, useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { AnswerProps } from "../types";
import { Button } from "@/components/ui";

function SortableItem({ id, label }: { id: string; label: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        isDragging ? "bg-bg-subtle border-accent" : "bg-bg border-border"
      } shadow-sm transition-colors mb-2`}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-text-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <span className="text-text font-medium">{label}</span>
    </div>
  );
}

export function RankingAnswer({ question, value, onChange, onSubmit }: AnswerProps<"ranking">) {
  const props = question.properties;
  
  // Use user's order if available, else properties.options
  const initialItems = useMemo(() => {
    if (Array.isArray(value) && value.length === props.options.length) {
      return value.map(id => props.options.find(o => o.id === id)!).filter(Boolean);
    }
    
    const items = [...props.options];
    if (props.randomize) {
      // Very simple deterministic shuffle for initial load
      items.sort((a, b) => a.id.localeCompare(b.id));
    }
    return items;
  }, [props.options, props.randomize, value]);

  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    onChange(items.map((i) => i.id));
  }, [items, onChange]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: import("@dnd-kit/core").DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col">
            {items.map((item) => (
              <SortableItem key={item.id} id={item.id} label={item.label} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      <div className="pt-2">
        <Button onClick={() => onSubmit()}>Submit</Button>
      </div>
    </div>
  );
}

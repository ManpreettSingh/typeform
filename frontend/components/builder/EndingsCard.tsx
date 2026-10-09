import { CopyPlus, GripVertical, MoreVertical, Plus, Trash2 } from "lucide-react";
import { IconButton, Menu } from "@/components/ui";
import { useBuilderStore } from "@/store/builderStore";
import { clsx } from "clsx";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { MenuTriggerProps } from "@/components/ui/Menu";

type SortableEndingItemProps = {
  id: string | number;
  title: string;
  isSelected: boolean;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function SortableEndingItem({ id, title, isSelected, onClick, onDuplicate, onDelete }: SortableEndingItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer min-h-[36px]",
        isSelected ? "bg-bg-hover text-text" : "hover:bg-bg-hover/60 text-text-soft",
        isDragging && "opacity-50 ring-2 ring-primary ring-inset"
      )}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab text-text-muted hover:text-text-soft active:cursor-grabbing px-1"
      >
        <GripVertical className="size-4" />
      </div>
      <div className="flex-1 truncate select-none font-medium">{title || "New ending"}</div>
      
      <Menu
        className="!absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100"
        items={[
          {
            label: "Duplicate",
            icon: <CopyPlus className="size-4 text-text-muted" />,
            onSelect: () => onDuplicate(),
          },
          {
            label: "Delete",
            icon: <Trash2 className="size-4" />,
            danger: true,
            separatorBefore: true,
            onSelect: () => onDelete(),
          },
        ]}
        trigger={(props: MenuTriggerProps) => (
          <IconButton
            {...props}
            size="sm"
            label="More options"
            icon={<MoreVertical className="size-4" />}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); props.onClick?.(); }}
          />
        )}
      />
    </div>
  );
}

export function EndingsCard() {
  const form = useBuilderStore((s) => s.form);
  const selectedEndingId = useBuilderStore((s) => s.selectedEndingId);
  const screen = useBuilderStore((s) => s.screen);
  const selectEnding = useBuilderStore((s) => s.selectEnding);
  const addEnding = useBuilderStore((s) => s.addEnding);
  const duplicateEnding = useBuilderStore((s) => s.duplicateEnding);
  const deleteEnding = useBuilderStore((s) => s.deleteEnding);
  const moveEnding = useBuilderStore((s) => s.moveEnding);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!form || !form.endings) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveEnding(active.id as number, over.id as number);
    }
  };

  return (
    <div className="flex flex-col gap-1 p-3 pt-0">
      <div className="mb-1 flex items-center justify-between px-2">
        <h2 className="text-sm font-semibold text-text">Endings</h2>
      </div>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={form.endings.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-0.5">
            {form.endings.map((ending) => (
              <SortableEndingItem
                key={ending.id}
                id={ending.id}
                title={ending.title}
                isSelected={screen === "ending" && selectedEndingId === ending.id}
                onClick={() => selectEnding(ending.id)}
                onDuplicate={() => duplicateEnding(ending.id)}
                onDelete={() => deleteEnding(ending.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-1 border-t border-border pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          leftIcon={<Plus className="size-4" aria-hidden />}
          onClick={() => addEnding()}
        >
          Add ending
        </Button>
      </div>
    </div>
  );
}

// Ensure Button is available
import { Button } from "@/components/ui";

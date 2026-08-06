import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PolicySection } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopicSortableListProps {
  sections: PolicySection[];
  onReorder: (sections: PolicySection[]) => void;
  onRemove: (id: string) => void;
}

function SortableTopicItem({
  section,
  index,
  onRemove,
}: {
  section: PolicySection;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2",
        isDragging && "z-10 shadow-md ring-2 ring-red-200",
      )}
    >
      <button
        type="button"
        className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium text-slate-800">
        {index + 1}. {section.title}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(section.id)}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}

export default function TopicSortableList({
  sections,
  onReorder,
  onRemove,
}: TopicSortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((item) => item.id === active.id);
    const newIndex = sections.findIndex((item) => item.id === over.id);
    onReorder(arrayMove(sections, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {sections.map((section, index) => (
            <SortableTopicItem
              key={section.id}
              section={section}
              index={index}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

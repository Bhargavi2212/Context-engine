import { useState, useEffect } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProductArea } from "../../types/product";

interface WizardStepAreasProps {
  initialData?: { product_area?: { id: string; data: Record<string, unknown> }[] } | null;
  areas?: ProductArea[];
  onSave: (data: { areas: ProductArea[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

function emptyArea(): ProductArea {
  return { name: "", description: "", order: 0 };
}

function SortableArea({
  area,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  area: ProductArea;
  index: number;
  onUpdate: (i: number, field: keyof ProductArea, value: string | number) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `area-${index}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 bg-gray-800/50 rounded-lg space-y-2 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex justify-between items-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-gray-400 hover:text-gray-100 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </button>
        <span className="text-sm text-gray-400">Area {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-400 hover:text-red-300 text-sm"
            aria-label="Remove area"
          >
            ✕
          </button>
        )}
      </div>
      <div>
        <label className={labelClass}>Name *</label>
        <input
          type="text"
          value={area.name}
          onChange={(e) => onUpdate(index, "name", e.target.value)}
          className={inputClass}
          placeholder="e.g. Checkout"
        />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={area.description ?? ""}
          onChange={(e) => onUpdate(index, "description", e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="Multi-step purchase flow..."
        />
      </div>
    </div>
  );
}

export default function WizardStepAreas({
  initialData,
  areas: initialAreas,
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepAreasProps) {
  const [areas, setAreas] = useState<ProductArea[]>([{ ...emptyArea(), order: 0 }]);

  useEffect(() => {
    const items = initialData?.product_area ?? initialAreas;
    if (items && Array.isArray(items) && items.length > 0) {
      const parsed = items.map((a, i) => {
        const d = "data" in a ? a.data : a;
        return {
          name: (d.name as string) ?? "",
          description: (d.description as string) ?? "",
          order: (d.order as number) ?? i,
        };
      });
      setAreas(parsed);
    } else if (initialAreas?.length) {
      setAreas(
        initialAreas.map((a, i) => ({
          name: a.name ?? "",
          description: a.description ?? "",
          order: a.order ?? i,
        }))
      );
    }
  }, [initialData, initialAreas]);

  const updateArea = (i: number, field: keyof ProductArea, value: string | number) => {
    setAreas((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addArea = () =>
    setAreas((prev) => [...prev, { ...emptyArea(), order: prev.length }]);
  const removeArea = (i: number) =>
    setAreas((prev) => prev.filter((_, idx) => idx !== i));

  const handleDragEnd = (event: { active: { id: string }; over: { id: string } | null }) => {
    if (!event.over) return;
    const oldIndex = parseInt(event.active.id.replace("area-", ""), 10);
    const newIndex = parseInt(event.over.id.replace("area-", ""), 10);
    if (oldIndex !== newIndex) {
      setAreas((prev) => {
        const reordered = arrayMove(prev, oldIndex, newIndex);
        return reordered.map((a, i) => ({ ...a, order: i }));
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = areas
      .filter((a) => a.name.trim())
      .map((a, i) => ({ ...a, order: i }));
    await onSave({ areas: valid });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={areas.map((_, i) => `area-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {areas.map((area, i) => (
            <SortableArea
              key={`area-${i}`}
              area={area}
              index={i}
              onUpdate={updateArea}
              onRemove={removeArea}
              canRemove={areas.length > 1}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addArea}
        className="text-blue-400 hover:text-blue-300 text-sm"
      >
        + Add area
      </button>
      <p className="text-sm text-gray-500">
        Add at least one area (not enforced). Product areas help auto-detect feedback topics.
      </p>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

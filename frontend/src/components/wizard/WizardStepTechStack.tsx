import { useState, useEffect } from "react";
import type { TechStackItem } from "../../types/product";

const CATEGORIES = [
  "Frontend",
  "Backend",
  "Database",
  "Infrastructure",
  "Analytics",
  "Auth",
  "Payments",
  "Other",
] as const;

interface WizardStepTechStackProps {
  techStack?: TechStackItem[];
  onSave: (data: { techStack: TechStackItem[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

function emptyTech(): TechStackItem {
  return { category: "", technology: "", notes: "" };
}

export default function WizardStepTechStack({
  techStack: initialTechStack = [],
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepTechStackProps) {
  const [techStack, setTechStack] = useState<TechStackItem[]>([emptyTech()]);

  useEffect(() => {
    if (initialTechStack?.length) {
      setTechStack(
        initialTechStack.map((t) => ({
          category: t.category ?? "",
          technology: t.technology ?? "",
          notes: t.notes ?? "",
        }))
      );
    }
  }, [initialTechStack]);

  const updateTech = (i: number, field: keyof TechStackItem, value: string) => {
    setTechStack((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addTech = () => setTechStack((prev) => [...prev, emptyTech()]);
  const removeTech = (i: number) =>
    setTechStack((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = techStack
      .filter((t) => t.category.trim() && t.technology.trim())
      .map((t) => ({
        category: t.category,
        technology: t.technology,
        notes: t.notes || undefined,
      }));
    await onSave({ techStack: valid });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {techStack.map((tech, i) => (
        <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Item {i + 1}</span>
            <button
              type="button"
              onClick={() => removeTech(i)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              ✕
            </button>
          </div>
          <div>
            <label className={labelClass}>Category *</label>
            <select
              value={tech.category}
              onChange={(e) => updateTech(i, "category", e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Technology *</label>
            <input
              type="text"
              value={tech.technology}
              onChange={(e) => updateTech(i, "technology", e.target.value)}
              required
              className={inputClass}
              placeholder="e.g. React"
            />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <input
              type="text"
              value={tech.notes ?? ""}
              onChange={(e) => updateTech(i, "notes", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addTech}
        className="text-blue-400 hover:text-blue-300 text-sm"
      >
        + Add tech stack entry
      </button>
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

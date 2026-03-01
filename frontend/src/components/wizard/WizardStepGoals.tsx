import { useState, useEffect } from "react";
import type { BusinessGoal, ProductArea } from "../../types/product";

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const TIME_PERIODS = ["Q1 2026", "Q2 2026", "H1 2026", "H2 2026", "2026"] as const;

interface WizardStepGoalsProps {
  initialData?: { business_goal?: { id: string; data: Record<string, unknown> }[] } | null;
  goals?: BusinessGoal[];
  areas?: ProductArea[];
  onSave: (data: { goals: BusinessGoal[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

function emptyGoal(): BusinessGoal {
  return { title: "", description: "", priority: undefined, time_period: undefined, linked_area: undefined };
}

export default function WizardStepGoals({
  initialData,
  goals: initialGoals,
  areas = [],
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepGoalsProps) {
  const [goals, setGoals] = useState<BusinessGoal[]>([emptyGoal()]);

  useEffect(() => {
    const items = initialData?.business_goal ?? initialGoals;
    if (items && Array.isArray(items) && items.length > 0) {
      const parsed = items.map((a) => {
        const d = "data" in a ? a.data : a;
        return {
          id: "id" in a ? (a as { id: string }).id : undefined,
          title: (d.title as string) ?? "",
          description: (d.description as string) ?? "",
          priority: (d.priority as BusinessGoal["priority"]) ?? undefined,
          time_period: (d.time_period as string) ?? undefined,
          linked_area: (d.linked_area as string) ?? undefined,
        };
      });
      setGoals(parsed);
    }
  }, [initialData, initialGoals]);

  const updateGoal = (i: number, field: keyof BusinessGoal, value: string | undefined) => {
    setGoals((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addGoal = () => setGoals((prev) => [...prev, emptyGoal()]);
  const removeGoal = (i: number) => setGoals((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = goals.filter((g) => g.title.trim());
    await onSave({ goals: valid });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {goals.map((goal, i) => (
        <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Goal {i + 1}</span>
            <button type="button" onClick={() => removeGoal(i)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
          </div>
          <div>
            <label className={labelClass}>Title *</label>
            <input type="text" value={goal.title} onChange={(e) => updateGoal(i, "title", e.target.value)} className={inputClass} placeholder="e.g. Increase conversion" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={goal.description ?? ""} onChange={(e) => updateGoal(i, "description", e.target.value)} rows={2} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Priority</label>
              <select value={goal.priority ?? ""} onChange={(e) => updateGoal(i, "priority", (e.target.value || undefined) as BusinessGoal["priority"])} className={inputClass}>
                <option value="">Select</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Time period</label>
              <select value={goal.time_period ?? ""} onChange={(e) => updateGoal(i, "time_period", e.target.value || undefined)} className={inputClass}>
                <option value="">Select</option>
                {TIME_PERIODS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {areas.length > 0 && (
            <div>
              <label className={labelClass}>Linked area</label>
              <select value={goal.linked_area ?? ""} onChange={(e) => updateGoal(i, "linked_area", e.target.value || undefined)} className={inputClass}>
                <option value="">None</option>
                {areas.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addGoal} className="text-blue-400 hover:text-blue-300 text-sm">+ Add goal</button>
      <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">{saving ? "Saving..." : submitLabel}</button>
    </form>
  );
}

import { useState, useEffect } from "react";
import type { RoadmapExisting, RoadmapPlanned, ProductArea } from "../../types/product";

const EXISTING_STATUS = ["Live", "Beta", "Alpha", "Deprecated"] as const;
const PLANNED_STATUS = ["Planned", "In Progress", "Blocked"] as const;
const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;

interface WizardStepRoadmapProps {
  existing?: RoadmapExisting[];
  planned?: RoadmapPlanned[];
  areas?: ProductArea[];
  onSave: (data: { existing: RoadmapExisting[]; planned: RoadmapPlanned[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

function emptyExisting(): RoadmapExisting {
  return { name: "", status: undefined, linked_area: undefined };
}

function emptyPlanned(): RoadmapPlanned {
  return { name: "", status: undefined, priority: undefined, target_date: undefined, linked_area: undefined };
}

export default function WizardStepRoadmap({
  existing: initialExisting = [],
  planned: initialPlanned = [],
  areas = [],
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepRoadmapProps) {
  const [existing, setExisting] = useState<RoadmapExisting[]>([emptyExisting()]);
  const [planned, setPlanned] = useState<RoadmapPlanned[]>([emptyPlanned()]);

  useEffect(() => {
    if (initialExisting?.length) {
      setExisting(
        initialExisting.map((e) => ({
          name: e.name ?? "",
          status: e.status,
          linked_area: e.linked_area,
        }))
      );
    }
    if (initialPlanned?.length) {
      setPlanned(
        initialPlanned.map((p) => ({
          name: p.name ?? "",
          status: p.status,
          priority: p.priority,
          target_date: p.target_date,
          linked_area: p.linked_area,
        }))
      );
    }
  }, [initialExisting, initialPlanned]);

  const updateExisting = (i: number, field: keyof RoadmapExisting, value: string | undefined) => {
    setExisting((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const updatePlanned = (i: number, field: keyof RoadmapPlanned, value: string | undefined) => {
    setPlanned((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addExisting = () => setExisting((prev) => [...prev, emptyExisting()]);
  const removeExisting = (i: number) => setExisting((prev) => prev.filter((_, idx) => idx !== i));
  const addPlanned = () => setPlanned((prev) => [...prev, emptyPlanned()]);
  const removePlanned = (i: number) => setPlanned((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ex = existing
      .filter((e) => e.name.trim())
      .map((e) => ({
        name: e.name,
        status: e.status,
        linked_area: e.linked_area,
      }));
    const pl = planned
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name,
        status: p.status,
        priority: p.priority,
        target_date: p.target_date,
        linked_area: p.linked_area,
      }));
    await onSave({ existing: ex, planned: pl });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h3 className="text-gray-300 mb-2">Existing features</h3>
        {existing.map((feat, i) => (
          <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2 mb-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Feature {i + 1}</span>
              <button
                type="button"
                onClick={() => removeExisting(i)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                ✕
              </button>
            </div>
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={feat.name}
                onChange={(e) => updateExisting(i, "name", e.target.value)}
                className={inputClass}
                placeholder="e.g. Checkout v2"
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={feat.status ?? ""}
                onChange={(e) => updateExisting(i, "status", (e.target.value || undefined) as RoadmapExisting["status"])}
                className={inputClass}
              >
                <option value="">Select</option>
                {EXISTING_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {areas.length > 0 && (
              <div>
                <label className={labelClass}>Linked area</label>
                <select
                  value={feat.linked_area ?? ""}
                  onChange={(e) => updateExisting(i, "linked_area", e.target.value || undefined)}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {areas.map((a) => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addExisting} className="text-blue-400 hover:text-blue-300 text-sm">
          + Add existing feature
        </button>
      </section>

      <section>
        <h3 className="text-gray-300 mb-2">Planned features</h3>
        {planned.map((feat, i) => (
          <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2 mb-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Planned {i + 1}</span>
              <button
                type="button"
                onClick={() => removePlanned(i)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                ✕
              </button>
            </div>
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={feat.name}
                onChange={(e) => updatePlanned(i, "name", e.target.value)}
                className={inputClass}
                placeholder="e.g. New reporting"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={feat.status ?? ""}
                  onChange={(e) => updatePlanned(i, "status", (e.target.value || undefined) as RoadmapPlanned["status"])}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {PLANNED_STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={feat.priority ?? ""}
                  onChange={(e) => updatePlanned(i, "priority", (e.target.value || undefined) as RoadmapPlanned["priority"])}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Target date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={feat.target_date ?? ""}
                onChange={(e) => updatePlanned(i, "target_date", e.target.value || undefined)}
                className={inputClass}
              />
            </div>
            {areas.length > 0 && (
              <div>
                <label className={labelClass}>Linked area</label>
                <select
                  value={feat.linked_area ?? ""}
                  onChange={(e) => updatePlanned(i, "linked_area", e.target.value || undefined)}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {areas.map((a) => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addPlanned} className="text-blue-400 hover:text-blue-300 text-sm">
          + Add planned feature
        </button>
      </section>

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

import { useState, useEffect } from "react";
import type { Competitor } from "../../types/product";

interface WizardStepCompetitorsProps {
  competitors?: Competitor[];
  onSave: (data: { competitors: Competitor[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

function emptyCompetitor(): Competitor {
  return { name: "", strengths: "", weaknesses: "", differentiation: "" };
}

export default function WizardStepCompetitors({
  competitors: initialCompetitors = [],
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepCompetitorsProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([emptyCompetitor()]);

  useEffect(() => {
    if (initialCompetitors?.length) {
      setCompetitors(
        initialCompetitors.map((c) => ({
          name: c.name ?? "",
          strengths: c.strengths ?? "",
          weaknesses: c.weaknesses ?? "",
          differentiation: c.differentiation ?? "",
        }))
      );
    }
  }, [initialCompetitors]);

  const updateCompetitor = (i: number, field: keyof Competitor, value: string) => {
    setCompetitors((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addCompetitor = () => setCompetitors((prev) => [...prev, emptyCompetitor()]);
  const removeCompetitor = (i: number) =>
    setCompetitors((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = competitors
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name,
        strengths: c.strengths || undefined,
        weaknesses: c.weaknesses || undefined,
        differentiation: c.differentiation || undefined,
      }));
    await onSave({ competitors: valid });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {competitors.map((comp, i) => (
        <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Competitor {i + 1}</span>
            <button
              type="button"
              onClick={() => removeCompetitor(i)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Remove
            </button>
          </div>
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={comp.name}
              onChange={(e) => updateCompetitor(i, "name", e.target.value)}
              className={inputClass}
              placeholder="e.g. Competitor Inc"
            />
          </div>
          <div>
            <label className={labelClass}>Strengths</label>
            <textarea
              value={comp.strengths ?? ""}
              onChange={(e) => updateCompetitor(i, "strengths", e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Weaknesses</label>
            <textarea
              value={comp.weaknesses ?? ""}
              onChange={(e) => updateCompetitor(i, "weaknesses", e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Differentiation</label>
            <textarea
              value={comp.differentiation ?? ""}
              onChange={(e) => updateCompetitor(i, "differentiation", e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addCompetitor}
        className="text-blue-400 hover:text-blue-300 text-sm"
      >
        + Add competitor
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

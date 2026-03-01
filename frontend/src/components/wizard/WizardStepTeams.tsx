import { useState, useEffect } from "react";
import type { Team, ProductArea } from "../../types/product";

interface WizardStepTeamsProps {
  teams?: Team[];
  areas?: ProductArea[];
  onSave: (data: { teams: Team[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass = "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

function emptyTeam(): Team {
  return { name: "", lead: "", owns_areas: [], size: undefined, slack_channel: "" };
}

export default function WizardStepTeams({
  teams: initialTeams = [],
  areas = [],
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepTeamsProps) {
  const [teams, setTeams] = useState<Team[]>([emptyTeam()]);

  useEffect(() => {
    if (initialTeams?.length) {
      setTeams(initialTeams.map((t) => ({
        name: t.name ?? "",
        lead: t.lead ?? "",
        owns_areas: t.owns_areas ?? [],
        size: t.size,
        slack_channel: t.slack_channel ?? "",
      })));
    }
  }, [initialTeams]);

  const updateTeam = (i: number, field: keyof Team, value: string | number | string[] | undefined) => {
    setTeams((prev) => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
  };

  const toggleOwnsArea = (teamIndex: number, areaName: string) => {
    setTeams((prev) => {
      const next = [...prev];
      const current = next[teamIndex].owns_areas ?? [];
      const idx = current.indexOf(areaName);
      const updated = idx >= 0 ? current.filter((a) => a !== areaName) : [...current, areaName];
      next[teamIndex] = { ...next[teamIndex], owns_areas: updated };
      return next;
    });
  };

  const addTeam = () => setTeams((prev) => [...prev, emptyTeam()]);
  const removeTeam = (i: number) => setTeams((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = teams.filter((t) => t.name.trim()).map((t) => ({
      name: t.name,
      lead: t.lead || undefined,
      owns_areas: t.owns_areas?.filter(Boolean) ?? [],
      size: t.size,
      slack_channel: t.slack_channel || undefined,
    }));
    await onSave({ teams: valid });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {teams.map((team, i) => (
        <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between"><span className="text-sm text-gray-400">Team {i + 1}</span><button type="button" onClick={() => removeTeam(i)} className="text-red-400 hover:text-red-300 text-sm">✕</button></div>
          <div><label className={labelClass}>Name *</label><input type="text" value={team.name} onChange={(e) => updateTeam(i, "name", e.target.value)} className={inputClass} placeholder="e.g. Platform" /></div>
          <div><label className={labelClass}>Lead</label><input type="text" value={team.lead ?? ""} onChange={(e) => updateTeam(i, "lead", e.target.value)} className={inputClass} /></div>
          {areas.length > 0 && (
            <div>
              <label className={labelClass}>Owns areas</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {areas.map((a) => (
                  <label key={a.name} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={(team.owns_areas ?? []).includes(a.name)} onChange={() => toggleOwnsArea(i, a.name)} className="rounded border-gray-600" />
                    <span>{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div><label className={labelClass}>Size</label><input type="number" min={0} value={team.size ?? ""} onChange={(e) => updateTeam(i, "size", e.target.value === "" ? undefined : Number(e.target.value))} className={inputClass} /></div>
          <div><label className={labelClass}>Slack channel</label><input type="text" value={team.slack_channel ?? ""} onChange={(e) => updateTeam(i, "slack_channel", e.target.value)} className={inputClass} placeholder="#platform" /></div>
        </div>
      ))}
      <button type="button" onClick={addTeam} className="text-blue-400 hover:text-blue-300 text-sm">+ Add team</button>
      <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">{saving ? "Saving..." : submitLabel}</button>
    </form>
  );
}

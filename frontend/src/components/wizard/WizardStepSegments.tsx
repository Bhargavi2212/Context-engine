import { useState, useEffect } from "react";
import type { CustomerSegment, PricingTier } from "../../types/product";

interface WizardStepSegmentsProps {
  segments?: CustomerSegment[];
  pricingTiers?: PricingTier[];
  onSave: (data: { segments: CustomerSegment[]; pricingTiers: PricingTier[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass = "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

function emptySegment(): CustomerSegment {
  return { name: "", description: "", revenue_share: undefined };
}

function emptyTier(): PricingTier {
  return { name: "", price: undefined, period: "monthly", target_segment: undefined };
}

export default function WizardStepSegments({
  segments: initialSegments = [],
  pricingTiers: initialTiers = [],
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepSegmentsProps) {
  const [segments, setSegments] = useState<CustomerSegment[]>([emptySegment()]);
  const [tiers, setTiers] = useState<PricingTier[]>([emptyTier()]);

  useEffect(() => {
    if (initialSegments?.length) {
      setSegments(initialSegments.map((s) => ({ name: s.name ?? "", description: s.description ?? "", revenue_share: s.revenue_share })));
    }
    if (initialTiers?.length) {
      setTiers(initialTiers.map((t) => ({ name: t.name ?? "", price: t.price, period: t.period ?? "monthly", target_segment: t.target_segment })));
    }
  }, [initialSegments, initialTiers]);

  const updateSegment = (i: number, field: keyof CustomerSegment, value: string | number | undefined) => {
    setSegments((prev) => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
  };

  const updateTier = (i: number, field: keyof PricingTier, value: string | number | undefined) => {
    setTiers((prev) => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
  };

  const addSegment = () => setSegments((prev) => [...prev, emptySegment()]);
  const removeSegment = (i: number) => setSegments((prev) => prev.filter((_, idx) => idx !== i));
  const addTier = () => setTiers((prev) => [...prev, emptyTier()]);
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const segmentNames = segments.filter((s) => s.name?.trim()).map((s) => s.name!);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const segs = segments.filter((s) => s.name.trim()).map((s) => ({ name: s.name, description: s.description || undefined, revenue_share: s.revenue_share }));
    const ts = tiers.filter((t) => t.name.trim()).map((t) => ({ name: t.name, price: t.price, period: t.period, target_segment: t.target_segment || undefined }));
    await onSave({ segments: segs, pricingTiers: ts });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h3 className="text-gray-300 mb-2">Customer segments</h3>
        {segments.map((seg, i) => (
          <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2 mb-2">
            <div className="flex justify-between"><span className="text-sm text-gray-400">Segment {i + 1}</span><button type="button" onClick={() => removeSegment(i)} className="text-red-400 hover:text-red-300 text-sm">✕</button></div>
            <div><label className={labelClass}>Name *</label><input type="text" value={seg.name} onChange={(e) => updateSegment(i, "name", e.target.value)} className={inputClass} placeholder="e.g. SMB" /></div>
            <div><label className={labelClass}>Description</label><input type="text" value={seg.description ?? ""} onChange={(e) => updateSegment(i, "description", e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Revenue share (%)</label><input type="number" min={0} value={seg.revenue_share ?? ""} onChange={(e) => updateSegment(i, "revenue_share", e.target.value === "" ? undefined : Number(e.target.value))} className={inputClass} /></div>
          </div>
        ))}
        <button type="button" onClick={addSegment} className="text-blue-400 hover:text-blue-300 text-sm">+ Add segment</button>
      </section>
      <section>
        <h3 className="text-gray-300 mb-2">Pricing tiers</h3>
        {tiers.map((tier, i) => (
          <div key={i} className="p-4 bg-gray-800/50 rounded-lg space-y-2 mb-2">
            <div className="flex justify-between"><span className="text-sm text-gray-400">Tier {i + 1}</span><button type="button" onClick={() => removeTier(i)} className="text-red-400 hover:text-red-300 text-sm">✕</button></div>
            <div><label className={labelClass}>Name *</label><input type="text" value={tier.name} onChange={(e) => updateTier(i, "name", e.target.value)} className={inputClass} placeholder="e.g. Pro" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelClass}>Price</label><input type="number" min={0} value={tier.price ?? ""} onChange={(e) => updateTier(i, "price", e.target.value === "" ? undefined : Number(e.target.value))} className={inputClass} /></div>
              <div><label className={labelClass}>Period</label><select value={tier.period ?? "monthly"} onChange={(e) => updateTier(i, "period", e.target.value as PricingTier["period"])} className={inputClass}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
            </div>
            {segmentNames.length > 0 && <div><label className={labelClass}>Target segment</label><select value={tier.target_segment ?? ""} onChange={(e) => updateTier(i, "target_segment", e.target.value || undefined)} className={inputClass}><option value="">None</option>{segmentNames.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>}
          </div>
        ))}
        <button type="button" onClick={addTier} className="text-blue-400 hover:text-blue-300 text-sm">+ Add tier</button>
      </section>
      <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">{saving ? "Saving..." : submitLabel}</button>
    </form>
  );
}

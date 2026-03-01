import { useState, useEffect } from "react";
import type { ProductBasics } from "../../types/product";

const INDUSTRIES = ["SaaS", "Fintech", "Healthcare", "E-commerce", "Education", "Media", "Other"] as const;
const STAGES = ["Pre-launch", "Early", "Growth", "Mature", "Enterprise"] as const;

interface WizardStepBasicsProps {
  initialData?: Partial<ProductBasics> | null;
  onSave: (data: ProductBasics) => Promise<void>;
  saving?: boolean;
  submitLabel?: "Save" | "Continue";
}

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "block text-sm text-gray-400 mb-1";

export default function WizardStepBasics({
  initialData,
  onSave,
  saving = false,
  submitLabel = "Save",
}: WizardStepBasicsProps) {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (initialData) {
      setProductName(initialData.product_name ?? "");
      setDescription(initialData.description ?? "");
      setIndustry(initialData.industry ?? "");
      setStage(initialData.stage ?? "");
      setWebsiteUrl(initialData.website_url ?? "");
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      product_name: productName.trim(),
      description: description.trim() || undefined,
      industry: industry.trim() || undefined,
      stage: stage.trim() || undefined,
      website_url: websiteUrl.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Product name *</label>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
          maxLength={200}
          className={inputClass}
          placeholder="e.g. Acme Analytics"
        />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className={inputClass}
          placeholder="What the product does"
        />
      </div>
      <div>
        <label className={labelClass}>Industry</label>
        <select
          value={industry || ""}
          onChange={(e) => setIndustry(e.target.value)}
          className={inputClass}
        >
          <option value="">Select industry</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Stage</label>
        <select
          value={stage || ""}
          onChange={(e) => setStage(e.target.value)}
          className={inputClass}
        >
          <option value="">Select stage</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Website URL</label>
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className={inputClass}
          placeholder="https://"
        />
      </div>
      <button
        type="submit"
        disabled={saving || !productName.trim()}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

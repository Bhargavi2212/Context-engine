import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { getFeedbackStats, type FeedbackStats } from "../../services/feedbackApi";
import { FEEDBACK_SOURCES } from "../../types/feedback";

export interface FeedbackFilters {
  product_area?: string;
  sentiment?: string;
  source?: string;
  customer_segment?: string;
  urgency?: string;
  feedback_type?: string;
  is_feedback?: boolean;
  date_from?: string;
  date_to?: string;
}

interface FilterBarProps {
  filters: FeedbackFilters;
  onChange: (f: FeedbackFilters) => void;
}

const DATE_PRESETS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const SENTIMENTS = ["positive", "negative", "neutral"] as const;
const URGENCIES = ["low", "medium", "high", "critical"] as const;
const FEEDBACK_TYPES = ["bug_report", "feature_request", "complaint", "praise", "question"] as const;

const SOURCE_LABELS: Record<string, string> = {
  app_store_review: "App Store",
  support_ticket: "Support",
  nps_survey: "NPS",
  slack: "Slack",
  email: "Email",
  sales_call: "Sales",
  internal: "Internal",
  interview: "Interview",
  bug_report: "Bug Report",
  g2_review: "G2",
  community: "Community",
  other: "Other",
};

function label(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    getFeedbackStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const areas = stats ? Object.keys(stats.by_feature_area).filter(Boolean).sort() : [];
  const sources = stats ? Object.keys(stats.by_source).filter(Boolean).sort() : [];
  const segments = stats ? Object.keys(stats.by_segment).filter(Boolean).sort() : [];

  const clearFilter = (key: keyof FeedbackFilters) => {
    const next = { ...filters };
    delete next[key];
    onChange(next);
  };

  const clearAll = () => {
    onChange({});
  };

  const setDateRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({
      ...filters,
      date_from: from.toISOString().split("T")[0],
      date_to: to.toISOString().split("T")[0],
    });
  };

  const activeCount =
    (filters.product_area ? 1 : 0) +
    (filters.sentiment ? 1 : 0) +
    (filters.source ? 1 : 0) +
    (filters.customer_segment ? 1 : 0) +
    (filters.urgency ? 1 : 0) +
    (filters.feedback_type ? 1 : 0) +
    (filters.date_from || filters.date_to ? 1 : 0);

  const pills: { key: keyof FeedbackFilters; label: string }[] = [];
  if (filters.product_area) pills.push({ key: "product_area", label: filters.product_area });
  if (filters.sentiment) pills.push({ key: "sentiment", label: label(filters.sentiment) });
  if (filters.source) pills.push({ key: "source", label: SOURCE_LABELS[filters.source] ?? label(filters.source) });
  if (filters.customer_segment) pills.push({ key: "customer_segment", label: filters.customer_segment });
  if (filters.urgency) pills.push({ key: "urgency", label: label(filters.urgency) });
  if (filters.feedback_type) pills.push({ key: "feedback_type", label: label(filters.feedback_type) });
  if (filters.date_from || filters.date_to) {
    pills.push({
      key: "date_from",
      label: `${filters.date_from ?? "?"} – ${filters.date_to ?? "?"}`,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-400 text-sm">Filter:</span>
        <div className="flex overflow-x-auto gap-2 py-1 min-w-0 max-w-full scrollbar-thin">
          {pills.map((p) => (
            <span
              key={String(p.key)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-indigo-600/80 text-white shrink-0"
            >
              {p.label}
              <button
                type="button"
                onClick={() => {
                  if (p.key === "date_from") {
                    onChange({ ...filters, date_from: undefined, date_to: undefined });
                  } else {
                    clearFilter(p.key);
                  }
                }}
                className="rounded hover:bg-white/20 p-0.5"
                aria-label={`Remove ${p.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
          {showAdd && (
            <div className="absolute left-0 top-full mt-1 p-3 rounded-lg border border-gray-600 bg-gray-800 shadow-lg z-20 min-w-[280px]">
              <div className="space-y-2 text-sm">
                <div>
                  <label className="text-gray-400 block mb-1">Product Area</label>
                  <select
                    value={filters.product_area ?? ""}
                    onChange={(e) => onChange({ ...filters, product_area: e.target.value || undefined })}
                    className="w-full rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                  >
                    <option value="">Any</option>
                    {areas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Sentiment</label>
                  <select
                    value={filters.sentiment ?? ""}
                    onChange={(e) => onChange({ ...filters, sentiment: e.target.value || undefined })}
                    className="w-full rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                  >
                    <option value="">Any</option>
                    {SENTIMENTS.map((s) => (
                      <option key={s} value={s}>{label(s)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Source</label>
                  <select
                    value={filters.source ?? ""}
                    onChange={(e) => onChange({ ...filters, source: e.target.value || undefined })}
                    className="w-full rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                  >
                    <option value="">Any</option>
                    {FEEDBACK_SOURCES.map((s) => (
                      <option key={s} value={s}>{SOURCE_LABELS[s] ?? label(s)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Segment</label>
                  <select
                    value={filters.customer_segment ?? ""}
                    onChange={(e) => onChange({ ...filters, customer_segment: e.target.value || undefined })}
                    className="w-full rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                  >
                    <option value="">Any</option>
                    {segments.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Urgency</label>
                  <select
                    value={filters.urgency ?? ""}
                    onChange={(e) => onChange({ ...filters, urgency: e.target.value || undefined })}
                    className="w-full rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                  >
                    <option value="">Any</option>
                    {URGENCIES.map((u) => (
                      <option key={u} value={u}>{label(u)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Type</label>
                  <select
                    value={filters.feedback_type ?? ""}
                    onChange={(e) => onChange({ ...filters, feedback_type: e.target.value || undefined })}
                    className="w-full rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                  >
                    <option value="">Any</option>
                    {FEEDBACK_TYPES.map((t) => (
                      <option key={t} value={t}>{label(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Date Range</label>
                  <div className="flex gap-1">
                    {DATE_PRESETS.map(({ label: l, days }) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setDateRange(days)}
                        className="rounded px-2 py-1 text-xs bg-gray-600 text-gray-300 hover:bg-gray-500"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="date"
                      value={filters.date_from ?? ""}
                      onChange={(e) => onChange({ ...filters, date_from: e.target.value || undefined })}
                      className="flex-1 rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                    />
                    <input
                      type="date"
                      value={filters.date_to ?? ""}
                      onChange={(e) => onChange({ ...filters, date_to: e.target.value || undefined })}
                      className="flex-1 rounded border border-gray-600 bg-gray-700 text-gray-200 py-1 px-2"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="mt-2 text-gray-400 hover:text-gray-200 text-xs"
              >
                Close
              </button>
            </div>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-gray-500 hover:text-gray-300 text-xs shrink-0"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

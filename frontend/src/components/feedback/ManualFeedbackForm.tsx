import { useState, useEffect, useCallback } from "react";
import { createFeedback } from "../../services/feedbackApi";
import { listCustomers } from "../../services/customerApi";
import { FEEDBACK_SOURCES } from "../../types/feedback";
import type { Customer } from "../../types/customer";

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm text-gray-400 mb-1";

export default function ManualFeedbackForm({
  onSuccess,
  onCancel,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("support_ticket");
  const [authorName, setAuthorName] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rating, setRating] = useState<number | undefined>();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    feedback_type?: string;
    sentiment?: string;
    feature_area?: string;
    team?: string;
    urgency?: string;
    confidence?: number;
  } | null>(null);

  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCustomers([]);
      return;
    }
    const res = await listCustomers({ search: q, per_page: 10 });
    setCustomers(res.data);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 200);
    return () => clearTimeout(t);
  }, [customerSearch, searchCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const fb = await createFeedback({
        text: text.trim(),
        source: source || undefined,
        author_name: authorName.trim() || undefined,
        customer_id: customerId || undefined,
        rating,
        created_at: date ? `${date}T12:00:00.000Z` : undefined,
      });
      setResult({
        feedback_type: fb.feedback_type || undefined,
        sentiment: fb.sentiment || undefined,
        feature_area: fb.feature_area || undefined,
        team: fb.team || undefined,
        urgency: fb.urgency || undefined,
        confidence: fb.confidence != null ? Math.round((fb.confidence as number) * 100) : undefined,
      });
      setText("");
      setAuthorName("");
      setCustomerId("");
      setCustomerSearch("");
      setRating(undefined);
      setDate(new Date().toISOString().slice(0, 10));
      onSuccess?.();
    } catch (err: unknown) {
      let msg = "Failed to add feedback";
      if (err && typeof err === "object" && "response" in err) {
        const res = (err as { response?: { data?: { detail?: string } } }).response;
        const detail = res?.data?.detail;
        if (typeof detail === "string") msg = detail;
      } else if (err instanceof Error) msg = err.message;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-medium text-gray-100">Add feedback manually</h3>
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {result && (
        <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-green-300 text-sm">
          Classified as: {result.feedback_type ?? "—"} | {result.sentiment ?? "—"} |{" "}
          {result.feature_area ?? "—"} | {result.team ?? "—"} | {result.urgency ?? "—"} urgency |{" "}
          {result.confidence != null ? `${result.confidence}%` : "—"} confidence
        </div>
      )}
      <div>
        <label className={labelClass}>Feedback text *</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
          rows={3}
          required
          disabled={submitting}
        />
      </div>
      <div>
        <label className={labelClass}>Source</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={inputClass}
          disabled={submitting}
        >
          {FEEDBACK_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Author name</label>
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className={inputClass}
          disabled={submitting}
        />
      </div>
      <div>
        <label className={labelClass}>Customer (search)</label>
        <input
          type="text"
          value={customerSearch}
          onChange={(e) => {
            setCustomerSearch(e.target.value);
            if (!e.target.value.trim()) setCustomerId("");
          }}
          placeholder="Search company name..."
          className={inputClass}
          disabled={submitting}
        />
        {customers.length > 0 && (
          <ul className="mt-1 max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-800">
            {customers.map((c) => (
              <li
                key={c.id}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-700 ${
                  customerId === c.id ? "bg-gray-700 text-blue-400" : "text-gray-200"
                }`}
                onClick={() => {
                  setCustomerId(c.id);
                  setCustomerSearch(c.company_name);
                  setCustomers([]);
                }}
              >
                {c.company_name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label className={labelClass}>Rating (1–5 stars, optional)</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? undefined : n)}
              className={`w-10 h-10 rounded text-lg ${
                rating !== undefined && rating >= n
                  ? "text-yellow-400"
                  : "text-gray-500 hover:text-gray-400"
              }`}
              disabled={submitting}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClass}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          disabled={submitting}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={submitting || !text.trim()}
        >
          {submitting ? "Adding…" : "Add feedback"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

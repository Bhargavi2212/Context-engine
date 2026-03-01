import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAgentChat } from "../contexts/AgentChatContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  getCustomer,
  getCustomerStats,
  getCustomerSentimentTrend,
  getCustomerFeedback,
  deleteCustomer,
} from "../services/customerApi";
import type { Customer } from "../types/customer";
import type { Feedback } from "../types/feedback";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Trash2 } from "lucide-react";
import { FeedbackCard } from "../components/feedback/FeedbackCard";
import { FeedbackDetailPanel } from "../components/feedback/FeedbackDetailPanel";

function formatCurrency(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function healthColor(score: number | undefined): string {
  if (score == null) return "text-gray-400";
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function daysToRenewal(renewalDate: string | undefined): number | null {
  if (!renewalDate) return null;
  const r = new Date(renewalDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  r.setHours(0, 0, 0, 0);
  return Math.ceil((r.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openChatWithMessage } = useAgentChat();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [stats, setStats] = useState<{
    total_feedback: number;
    sentiment_breakdown: Record<string, number>;
    avg_sentiment_score: number;
    top_areas: string[];
    recent_trend: string;
    first_feedback_date: string | null;
    last_feedback_date: string | null;
  } | null>(null);
  const [sentimentTrend, setSentimentTrend] = useState<{ date: string | null; avg_sentiment: number; count: number }[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailFeedback, setDetailFeedback] = useState<Feedback | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getCustomer(id),
      getCustomerStats(id).catch(() => null),
      getCustomerSentimentTrend(id).catch(() => []),
      getCustomerFeedback(id, { page: 1, page_size: 50 }).catch(() => ({ data: [] })),
    ])
      .then(([c, s, t, f]) => {
        setCustomer(c);
        setStats(s ?? null);
        setSentimentTrend(Array.isArray(t) ? t : []);
        setFeedback(Array.isArray(f?.data) ? f.data : []);
      })
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Customer not found</p>
        <button
          type="button"
          onClick={() => navigate("/customers")}
          className="mt-4 text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Customers
        </button>
      </div>
    );
  }

  const days = daysToRenewal(customer.renewal_date);
  const renewalLabel = days != null
    ? days > 0
      ? `in ${days} days`
      : days === 0
        ? "today"
        : `${Math.abs(days)} days ago`
    : formatDate(customer.renewal_date);

  const handleDelete = async () => {
    if (!id || !window.confirm(`Delete "${customer.company_name}"? Their feedback will be unlinked (not deleted).`)) return;
    setDeleting(true);
    try {
      await deleteCustomer(id);
      navigate("/customers");
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate("/customers")}
          className="text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Customers
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-red-900/50 text-red-300 hover:bg-red-800/50 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" /> Delete customer
        </button>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">{customer.company_name}</h1>
        <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-400">
          {customer.segment && <span>{customer.segment}</span>}
          {customer.plan && <span>· {customer.plan}</span>}
          {customer.industry && <span>· {customer.industry}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/50">
          <p className="text-xs text-gray-500 uppercase mb-1">ARR</p>
          <p className="text-xl font-semibold text-gray-100">{formatCurrency(customer.arr)}</p>
        </div>
        <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/50">
          <p className="text-xs text-gray-500 uppercase mb-1">Health</p>
          <p className={`text-xl font-semibold ${healthColor(customer.health_score)}`}>
            {customer.health_score ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/50">
          <p className="text-xs text-gray-500 uppercase mb-1">Renewal</p>
          <p className="text-xl font-semibold text-gray-100">{renewalLabel}</p>
        </div>
        <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/50">
          <p className="text-xs text-gray-500 uppercase mb-1">Feedback</p>
          <p className="text-xl font-semibold text-gray-100">
            {customer.feedback_count ?? feedback.length ?? 0}
          </p>
        </div>
      </div>

      <div className="mb-6 text-sm text-gray-400">
        {customer.account_manager && (
          <p>Account Manager: {customer.account_manager}</p>
        )}
        {customer.employee_count != null && (
          <p>Employees: {customer.employee_count.toLocaleString()}</p>
        )}
      </div>

      {sentimentTrend.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Sentiment Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentTrend.filter((p) => p.date)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  domain={[-1, 1]}
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                  formatter={(value: number) => [value.toFixed(2), "Avg sentiment"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="avg_sentiment"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: "#6366f1", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Feedback History</h3>
      {feedback.length === 0 ? (
        <p className="text-gray-500 text-sm">No feedback linked to this customer.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {feedback.map((f) => (
            <FeedbackCard
              key={f.id}
              item={f}
              onClick={() => setDetailFeedback(f)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => openChatWithMessage(`What's the situation with ${customer.company_name}?`)}
        className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm"
        title="Opens agent chat with customer-specific message"
      >
        Chat: &quot;What&apos;s the situation with {customer.company_name}?&quot;
      </button>

      {detailFeedback && (
        <FeedbackDetailPanel
          feedback={detailFeedback}
          onClose={() => setDetailFeedback(null)}
          onSelectSimilar={(f) => setDetailFeedback(f)}
          onDeleted={async () => {
            setDetailFeedback(null);
            if (id) {
              getCustomerFeedback(id, { page: 1, page_size: 50 })
                .then((res) => setFeedback(res.data ?? []))
                .catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}

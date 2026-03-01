import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAgentChat } from "../../contexts/AgentChatContext";
import type { Feedback } from "../../types/feedback";
import type { Customer } from "../../types/customer";
import { getSimilarFeedback, deleteFeedback } from "../../services/feedbackApi";
import { getCustomer } from "../../services/customerApi";

const FEEDBACK_TYPE_ICONS: Record<string, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  complaint: "Complaint",
  praise: "Praise",
  question: "Question",
  noise: "Noise",
};

function SourceIcon({ source }: { source?: string | null }) {
  if (!source) return null;
  const icons: Record<string, string> = {
    app_store_review: "App Store",
    support_ticket: "Support",
    nps_survey: "NPS",
    slack: "Slack",
    email: "Email",
    sales_call: "Sales",
    internal: "Internal",
    interview: "Interview",
    g2_review: "G2",
    community: "Community",
    other: "Other",
  };
  const label = icons[source] ?? source.replace(/_/g, " ");
  return <span className="text-sm">{label}</span>;
}

function RatingStars({ rating }: { rating?: number | null }) {
  if (rating == null) return null;
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return (
    <span className="text-amber-400" title={`${rating} / 5`}>
      {"★".repeat(full)}{hasHalf ? "½" : ""}{"☆".repeat(5 - full - (hasHalf ? 1 : 0))}
    </span>
  );
}

function formatCurrency(n: number | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

interface FeedbackDetailPanelProps {
  feedback: Feedback | null;
  onClose: () => void;
  onSelectSimilar?: (f: Feedback) => void;
  /** Called after feedback is deleted; parent should refetch and close. */
  onDeleted?: () => void;
  /** When true, panel is an inline column next to the list (Hackathon style). When false, opens as overlay. */
  inline?: boolean;
}

export function FeedbackDetailPanel({ feedback, onClose, onSelectSimilar, onDeleted, inline }: FeedbackDetailPanelProps) {
  const navigate = useNavigate();
  const { openChatWithMessage, setContextFeedback } = useAgentChat();
  const [similar, setSimilar] = useState<Feedback[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!feedback) {
      setSimilar([]);
      setCustomer(null);
      setContextFeedback(null);
      return;
    }
    getSimilarFeedback(feedback.id)
      .then(setSimilar)
      .catch(() => setSimilar([]));
    if (feedback.customer_id) {
      getCustomer(feedback.customer_id)
        .then(setCustomer)
        .catch(() => setCustomer(null));
    } else {
      setCustomer(null);
    }
  }, [feedback?.id, feedback?.customer_id, setContextFeedback]);

  useEffect(() => {
    if (!feedback) {
      setContextFeedback(null);
      return () => setContextFeedback(null);
    }
    const excerpt = feedback.text.length > 280 ? feedback.text.slice(0, 280) + "…" : feedback.text;
    setContextFeedback({
      feedbackExcerpt: excerpt,
      companyName: customer?.company_name ?? feedback.customer_name ?? null,
      featureArea: feedback.feature_area ?? null,
    });
    return () => setContextFeedback(null);
  }, [feedback?.id, feedback?.text, feedback?.feature_area, feedback?.customer_name, customer?.company_name, setContextFeedback]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleDelete = async () => {
    if (!feedback || !window.confirm("Delete this feedback item? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteFeedback(feedback.id);
      onDeleted?.();
      onClose();
    } catch {
      setDeleting(false);
    }
  };

  if (!feedback) return null;

  const featureArea = feedback.feature_area ?? "this area";
  const companyName = customer?.company_name ?? feedback.customer_name ?? null;
  const feedbackExcerpt = feedback.text.length > 280 ? feedback.text.slice(0, 280) + "…" : feedback.text;
  const contextPrefix =
    companyName != null
      ? `I'm viewing this feedback from **${companyName}**. Feedback: "${feedbackExcerpt}". `
      : `I'm viewing this feedback. Feedback: "${feedbackExcerpt}". `;
  const typeLabel = FEEDBACK_TYPE_ICONS[feedback.feedback_type || ""] ?? feedback.feedback_type ?? "Feedback";
  const sentimentCls =
    feedback.sentiment === "positive"
      ? "text-green-400"
      : feedback.sentiment === "negative"
        ? "text-red-400"
        : "text-gray-400";
  const urgencyCls =
    feedback.urgency === "critical"
      ? "text-red-500"
      : feedback.urgency === "high"
        ? "text-orange-400"
        : feedback.urgency === "medium"
          ? "text-yellow-400"
          : "text-gray-400";

  const panelContent = (
    <div
      className={`bg-gray-900 border-l border-gray-700 shadow-xl overflow-y-auto flex flex-col ${inline ? "w-full max-w-md lg:max-w-lg h-full min-h-0" : "relative w-full max-w-md lg:max-w-lg h-full"}`}
    >
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between gap-4 z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-200"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() =>
                openChatWithMessage(
                  contextPrefix + `I want to know more about this customer and this feedback.`
                )
              }
              className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-500"
              title="Open chat with this feedback and customer context"
            >
              Investigate
            </button>
            <button
              type="button"
              onClick={() =>
                openChatWithMessage(
                  contextPrefix + `Generate specs for ${feedback.feature_area ?? "this area"}.`
                )
              }
              className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-500"
              title="Generate specs for this feedback area"
            >
              Generate Spec
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-50"
              title="Delete this feedback"
              aria-label="Delete feedback"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-5 flex-1">
          <h2 id="feedback-detail-title" className="sr-only">
            Feedback detail
          </h2>
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
            {feedback.text}
          </p>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Classification</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-gray-500">Type:</span>
              <span className="text-gray-300">{typeLabel}</span>
              <span className="text-gray-500">Sentiment:</span>
              <span className={sentimentCls}>
                {feedback.sentiment
                  ? feedback.sentiment.charAt(0).toUpperCase() + feedback.sentiment.slice(1)
                  : "—"}{" "}
                {feedback.sentiment_score != null && `(${feedback.sentiment_score.toFixed(2)})`}
              </span>
              <span className="text-gray-500">Area:</span>
              <span className="text-gray-300">{feedback.feature_area ?? "—"}</span>
              <span className="text-gray-500">Team:</span>
              <span className="text-gray-300">{feedback.team ?? "—"}</span>
              <span className="text-gray-500">Urgency:</span>
              <span className={urgencyCls}>{feedback.urgency ?? "—"}</span>
              <span className="text-gray-500">Confidence:</span>
              <span className="text-gray-300">
                {feedback.confidence != null ? `${Math.round(feedback.confidence * 100)}%` : "—"}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Source</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-gray-500">Source:</span>{" "}
                <SourceIcon source={feedback.source} />
              </p>
              {feedback.author_name && (
                <p>
                  <span className="text-gray-500">Author:</span> {feedback.author_name}
                </p>
              )}
              {feedback.rating != null && (
                <p>
                  <span className="text-gray-500">Rating:</span>{" "}
                  <RatingStars rating={feedback.rating} />
                </p>
              )}
              <p>
                <span className="text-gray-500">Date:</span>{" "}
                {feedback.created_at
                  ? new Date(feedback.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : feedback.ingested_at
                    ? new Date(feedback.ingested_at).toLocaleDateString()
                    : "—"}
              </p>
            </div>
          </div>

          {customer && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</h3>
              <div className="rounded-lg border border-gray-700 p-3 bg-gray-800/50">
                <p className="font-medium text-gray-200">{customer.company_name}</p>
                <p className="text-sm text-gray-400">
                  {customer.segment ?? "—"} · {formatCurrency(customer.arr)} ARR
                </p>
                <p className="text-sm text-gray-400">
                  Health: {customer.health_score ?? "—"} · Renewal:{" "}
                  {customer.renewal_date
                    ? new Date(customer.renewal_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/customers/${feedback.customer_id}`);
                  }}
                  className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm"
                >
                  View Profile →
                </button>
              </div>
            </div>
          )}

          {similar.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Similar Feedback</h3>
              <ul className="space-y-2">
                {similar.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelectSimilar?.(s)}
                      className="text-left w-full text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-800 rounded p-2"
                    >
                      <span className="line-clamp-2">{s.text}</span>
                      {s.similarity_score != null && (
                        <span className="text-gray-500 text-xs">
                          {Math.round(s.similarity_score * 100)}% similar
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
  );

  if (inline) {
    return (
      <div className="shrink-0 w-full max-w-md lg:max-w-lg flex flex-col min-h-0" role="region" aria-labelledby="feedback-detail-title">
        {panelContent}
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal aria-labelledby="feedback-detail-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      {panelContent}
    </div>
  );
}

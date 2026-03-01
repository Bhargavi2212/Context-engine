import { memo } from "react";
import { Link } from "react-router-dom";
import type { Feedback } from "../../types/feedback";

const FEEDBACK_TYPE_ICONS: Record<string, string> = {
  bug_report: "🐛",
  feature_request: "✨",
  complaint: "😠",
  praise: "👍",
  question: "❓",
  noise: "💬",
};

const SOURCE_ICONS: Record<string, string> = {
  app_store_review: "📱",
  support_ticket: "🎫",
  nps_survey: "📊",
  slack: "💬",
  email: "✉️",
  sales_call: "📞",
  internal: "🏢",
  interview: "🎤",
  g2_review: "⭐",
  community: "👥",
  other: "📄",
};

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len).trim() + "…";
}

function formatDateForTooltip(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "today";
  if (diff === 1) return "1 day ago";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface FeedbackCardProps {
  item: Feedback;
  onClick?: () => void;
  isSearchMode?: boolean;
}

export const FeedbackCard = memo(function FeedbackCard({ item, onClick, isSearchMode }: FeedbackCardProps) {
  const textPreview = truncate(item.text ?? "", 120);
  const typeIcon = FEEDBACK_TYPE_ICONS[item.feedback_type || ""] ?? "💬";
  const sourceIcon = SOURCE_ICONS[item.source || ""] ?? "📄";
  const sentiment = (item.sentiment || "").toLowerCase();
  const sentimentCls =
    sentiment === "positive"
      ? "text-green-400"
      : sentiment === "negative"
        ? "text-red-400"
        : "text-gray-400";
  const urgency = (item.urgency || "").toLowerCase();
  const urgencyCls =
    urgency === "critical"
      ? "text-red-500"
      : urgency === "high"
        ? "text-orange-400"
        : urgency === "medium"
          ? "text-yellow-400"
          : "text-gray-400";
  const conf = item.confidence != null ? Math.round(item.confidence * 100) : null;
  const confCls =
    conf != null && conf < 50
      ? "text-red-400"
      : conf != null && conf < 70
        ? "text-orange-400"
        : "text-gray-400";
  const isNoise = !item.is_feedback;
  const isHighUrgency = urgency === "critical" || urgency === "high";
  const sentimentDotBg =
    sentiment === "positive" ? "bg-green-400" : sentiment === "negative" ? "bg-red-400" : "bg-gray-400";
  const simPct =
    isSearchMode && item.similarity_score != null
      ? Math.round(item.similarity_score * 100)
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
      className={`rounded-lg border border-gray-600 p-4 transition hover:border-gray-500 cursor-pointer text-left ${
        isNoise ? "bg-gray-800/30 opacity-75" : "bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${sentimentDotBg}`} title={item.sentiment ?? ""} aria-hidden />
        <p className={`text-gray-200 text-sm leading-relaxed ${isHighUrgency ? "font-semibold" : ""}`}>
          {textPreview}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
        {item.feature_area && (
          <span className="rounded bg-blue-900/60 px-2 py-0.5 text-blue-300">{item.feature_area}</span>
        )}
        {item.team && (
          <span className="rounded bg-purple-900/60 px-2 py-0.5 text-purple-300">{item.team}</span>
        )}
        <span title={item.feedback_type ?? ""}>{typeIcon}</span>
        {item.urgency && <span className={urgencyCls}>{item.urgency}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span title={item.source?.replace(/_/g, " ")}>{sourceIcon}</span>
        <span className="text-gray-500">{item.source?.replace(/_/g, " ")}</span>
        {item.customer_name && (
          <Link
            to={`/customers/${item.customer_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            {item.customer_name}
          </Link>
        )}
        <span className="text-gray-500" title={formatDateForTooltip(item.created_at ?? item.ingested_at)}>
          {formatRelative(item.created_at ?? item.ingested_at)}
        </span>
        {conf != null && <span className={confCls}>{conf}%</span>}
        {simPct != null && (
          <span className="text-gray-500 ml-auto">{simPct}% match</span>
        )}
      </div>
      {isNoise && (
        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">noise</span>
      )}
    </div>
  );
});

import { useNavigate } from "react-router-dom";
import type { RecentFeedbackItem as RecentFeedbackItemType } from "../../services/dashboardApi";

interface RecentFeedbackProps {
  data: RecentFeedbackItemType[];
  loading: boolean;
}

function sentimentDot(sentiment: string): string {
  if (sentiment === "positive") return "bg-green-500";
  if (sentiment === "negative") return "bg-red-500";
  return "bg-gray-500";
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function RecentFeedback({ data, loading }: RecentFeedbackProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-64 animate-pulse" />
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 relative">
      <h3 className="text-sm font-medium text-gray-300">Recent Feedback</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-2">Latest feedback items. Sentiment dot, area, and customer per row. Click to open full feedback.</p>
      <div className="rounded border border-gray-600 bg-gray-900/80 px-2 py-1.5 text-xs mb-3">
        <p className="font-medium text-gray-300 mb-1">Each row:</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-200">
          <span>• Dot = sentiment (green +, red −, gray neutral)</span>
          <span>• Area = product feature</span>
          <span>• Click → feedback detail</span>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No feedback in this period</p>
      ) : (
        <ul className="space-y-2">
          {data.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => navigate(`/feedback?highlight=${item.id}`)}
                className="w-full text-left rounded border border-gray-600 p-2 hover:border-gray-500 hover:bg-gray-700/30 transition flex gap-2 items-start"
              >
                <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${sentimentDot(item.sentiment)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 truncate" title={item.text}>
                    {item.text}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.feature_area ?? "—"} · {item.customer_name ?? "—"} · {formatRelative(item.created_at)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

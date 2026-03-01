import { useNavigate } from "react-router-dom";
import type { DashboardSummary } from "../../services/dashboardApi";

interface SummaryCardsProps {
  data: DashboardSummary | null;
  loading: boolean;
  onScrollToIssues?: () => void;
}

export function SummaryCards({ data, loading, onScrollToIssues }: SummaryCardsProps) {
  const navigate = useNavigate();

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-600 bg-gray-800/50 h-24 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const avgSentiment = data.avg_sentiment ?? null;
  const sentimentColor =
    avgSentiment == null
      ? "text-gray-400"
      : avgSentiment < 0
        ? "text-red-400"
        : "text-green-400";
  const sentimentDisplay =
    avgSentiment != null ? avgSentiment.toFixed(2) : "—";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <button
        type="button"
        onClick={() => navigate("/feedback")}
        className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 hover:border-blue-500/50 transition text-left"
      >
        <p className="text-2xl font-semibold text-blue-400">{data.total_feedback}</p>
        <p className="text-sm text-gray-400 mt-1">Total Feedback</p>
      </button>
      <button
        type="button"
        onClick={() => navigate("/feedback?sentiment=negative")}
        className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 hover:border-gray-500 transition text-left"
      >
        <p className={`text-2xl font-semibold ${sentimentColor}`}>
          {sentimentDisplay}
        </p>
        <p className="text-sm text-gray-400 mt-1">Avg Sentiment</p>
      </button>
      <button
        type="button"
        onClick={() => navigate("/customers")}
        className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 hover:border-blue-500/50 transition text-left"
      >
        <p className="text-2xl font-semibold text-blue-400">{data.active_customers}</p>
        <p className="text-sm text-gray-400 mt-1">Active Customers</p>
      </button>
      <button
        type="button"
        onClick={onScrollToIssues}
        className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 hover:border-orange-500/50 transition text-left"
      >
        <p className="text-2xl font-semibold text-orange-400">{data.open_issues}</p>
        <p className="text-sm text-gray-400 mt-1">Open Issues</p>
      </button>
    </div>
  );
}

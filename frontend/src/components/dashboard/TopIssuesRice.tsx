import { useNavigate } from "react-router-dom";
import { useAgentChat } from "../../contexts/AgentChatContext";
import type { TopIssueRice as TopIssueRiceType } from "../../services/dashboardApi";
import { TrendingUp, Minus, TrendingDown, Sparkles } from "lucide-react";

interface TopIssuesRiceProps {
  data: TopIssueRiceType[];
  loading: boolean;
}

function riceBadgeColor(score: number): string {
  if (score >= 70) return "bg-red-500/80 text-white";
  if (score >= 40) return "bg-orange-500/80 text-white";
  return "bg-yellow-500/80 text-gray-900";
}

function formatArr(arr: number): string {
  if (arr >= 1_000_000) return `$${(arr / 1_000_000).toFixed(1)}M`;
  if (arr >= 1_000) return `$${(arr / 1_000).toFixed(0)}K`;
  return `$${arr}`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "worsening") return <TrendingUp className="text-red-400 inline w-4 h-4" />;
  if (trend === "improving") return <TrendingDown className="text-green-400 inline w-4 h-4" />;
  if (trend === "new") return <Sparkles className="text-amber-400 inline w-4 h-4" />;
  return <Minus className="text-gray-400 inline w-4 h-4" />;
}

export function TopIssuesRice({ data, loading }: TopIssuesRiceProps) {
  const navigate = useNavigate();
  const { openChatWithMessage } = useAgentChat();

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-80 animate-pulse" />
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Top Issues (RICE)</h3>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No issues with enough feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((issue, i) => (
            <li key={issue.feature_area} className="border-b border-gray-700 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/feedback?area=${encodeURIComponent(issue.feature_area)}`)}
                    className="font-medium text-gray-200 hover:text-blue-400 text-left"
                  >
                    {i + 1}. {issue.feature_area}
                  </button>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {issue.feedback_count} items · {issue.unique_customers} customers ·{" "}
                    {formatArr(issue.arr_at_risk)} at risk
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      <TrendIcon trend={issue.trend} />
                      {issue.trend}
                    </span>
                  </p>
                  {issue.team && (
                    <p className="text-xs text-gray-500 mt-0.5">{issue.team}</p>
                  )}
                  {issue.related_goal && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">{issue.related_goal}</p>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${riceBadgeColor(issue.rice_score)}`}>
                  RICE {issue.rice_score}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => openChatWithMessage(`Tell me more about ${issue.feature_area} issues`)}
                  className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
                >
                  Investigate
                </button>
                <button
                  type="button"
                  onClick={() => openChatWithMessage(`Generate specs for ${issue.feature_area}`)}
                  className="text-xs px-2 py-1 rounded bg-indigo-600/80 text-white hover:bg-indigo-600"
                >
                  Specs
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useAgentChat } from "../../contexts/AgentChatContext";
import type { AtRiskCustomer } from "../../services/dashboardApi";

interface AtRiskTableProps {
  data: AtRiskCustomer[];
  loading: boolean;
}

function formatArr(arr: number): string {
  if (arr >= 1_000_000) return `$${(arr / 1_000_000).toFixed(1)}M`;
  if (arr >= 1_000) return `$${(arr / 1_000).toFixed(0)}K`;
  return `$${arr}`;
}

function healthColor(score: number | null | undefined): string {
  if (score == null) return "text-gray-400";
  if (score < 40) return "text-red-400";
  if (score < 70) return "text-yellow-400";
  return "text-green-400";
}

function renewalColor(days: number | null): string {
  if (days == null) return "text-gray-400";
  if (days < 30) return "text-red-400";
  if (days < 60) return "text-orange-400";
  return "text-gray-300";
}

export function AtRiskTable({ data, loading }: AtRiskTableProps) {
  const navigate = useNavigate();
  const { openChatWithMessage } = useAgentChat();

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-80 animate-pulse" />
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 overflow-x-auto">
      <h3 className="text-sm font-medium text-gray-300 mb-3">At-Risk Customers</h3>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No at-risk customers.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-2">Company</th>
              <th className="pb-2 pr-2">ARR</th>
              <th className="pb-2 pr-2">Health</th>
              <th className="pb-2 pr-2">Renewal</th>
              <th className="pb-2 pr-2">Top Complaint</th>
              <th className="pb-2 pr-2" />
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-b border-gray-700/50">
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="text-gray-200 hover:text-blue-400 font-medium"
                  >
                    {c.company_name}
                  </button>
                </td>
                <td className="py-2 pr-2 text-gray-300">{formatArr(c.arr)}</td>
                <td className={`py-2 pr-2 font-medium ${healthColor(c.health_score)}`}>
                  {c.health_score != null ? c.health_score : "—"}
                </td>
                <td className={`py-2 pr-2 ${renewalColor(c.days_to_renewal)}`}>
                  {c.days_to_renewal != null ? `${c.days_to_renewal}d` : "—"}
                </td>
                <td className="py-2 pr-2 text-gray-400">{c.top_complaint ?? "—"}</td>
                <td className="py-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => openChatWithMessage(`What's the situation with ${c.company_name}?`)}
                    className="text-xs px-2 py-1 rounded bg-indigo-600/80 text-white hover:bg-indigo-600"
                  >
                    Chat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

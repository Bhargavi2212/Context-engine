import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";
import { useAgentChat } from "../contexts/AgentChatContext";
import { listSpecs } from "../services/specsApi";
import type { SpecListItem } from "../types/specs";

function formatDate(created_at: string): string {
  try {
    return new Date(created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  catch {
    return created_at;
  }
}

function formatArr(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function SpecsPage() {
  const navigate = useNavigate();
  const { openChat, openChatWithMessage } = useAgentChat();
  const [specs, setSpecs] = useState<SpecListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSpecs({ page: 1, page_size: 50 })
      .then((res) => {
        setSpecs(res.data);
        setTotal(res.total);
      })
      .catch(() => setSpecs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-400">Loading specs…</p>
      </div>
    );
  }

  if (specs.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="No specs yet"
          message="Use the agent chat to generate specs from your feedback and customers."
          primaryButton={{ label: "Open Agent Chat", onClick: openChat }}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Engineering Specs</h1>
        <button
          type="button"
          onClick={() => openChatWithMessage("Generate specs for ")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
        >
          + Generate New
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specs.map((spec) => (
          <button
            key={spec.id}
            type="button"
            onClick={() => navigate(`/specs/${spec.id}`)}
            className="text-left p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-colors"
          >
            <p className="font-medium text-gray-100 truncate">{spec.topic}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400">
              <span
                className={
                  spec.status === "final"
                    ? "text-green-400"
                    : spec.status === "shared"
                      ? "text-blue-400"
                      : "text-amber-400"
                }
              >
                {spec.status}
              </span>
              <span>RICE: {spec.rice_score ?? "—"}</span>
              <span>{formatArr(spec.arr_impacted ?? 0)} ARR</span>
              <span>{spec.feedback_count ?? 0} feedback</span>
              <span>{formatDate(spec.created_at)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

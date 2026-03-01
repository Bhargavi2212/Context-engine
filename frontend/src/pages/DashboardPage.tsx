import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getDashboardData } from "../services/dashboardApi";
import type { DashboardData } from "../services/dashboardApi";
import { useAgentChat } from "../contexts/AgentChatContext";
import {
  SummaryCards,
  VolumeChart,
  SentimentDonut,
  TopIssuesRice,
  AtRiskTable,
  RecentFeedback,
  SourceDistribution,
  AreaBreakdown,
  SegmentBreakdown,
  CustomizeDashboard,
  getStoredWidgets,
} from "../components/dashboard";
import EmptyState from "../components/common/EmptyState";

function formatLastUpdated(ms: number): string {
  if (ms < 60_000) return "just now";
  if (ms < 120_000) return "1 min ago";
  const mins = Math.floor(ms / 60_000);
  return `${mins} min ago`;
}

function periodToDates(period: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (period === "7d") from.setDate(to.getDate() - 7);
  else if (period === "90d") from.setDate(to.getDate() - 90);
  else from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

const DEFAULT_WIDGETS = [
  "summary",
  "volume",
  "sentiment",
  "top_issues",
  "areas",
  "at_risk",
  "recent",
  "sources",
  "segments",
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { openChat, openChatWithMessage } = useAgentChat();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("just now");
  const [period, setPeriod] = useState("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(() => getStoredWidgets());
  const [refreshing, setRefreshing] = useState(false);
  const topIssuesRef = useRef<HTMLDivElement>(null);

  const { from: paramFrom, to: paramTo } =
    period === "custom" && dateFrom && dateTo
      ? { from: dateFrom, to: dateTo }
      : periodToDates(period);

  const fetchDashboard = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params =
          period === "custom" && dateFrom && dateTo
            ? { period: "custom", date_from: dateFrom, date_to: dateTo }
            : { period };
        const result = await getDashboardData(params);
        setData(result);
        setLastFetchedAt(Date.now());
        setLastUpdatedLabel("just now");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, dateFrom, dateTo]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const stored = getStoredWidgets();
    if (stored.length > 0) setVisibleWidgets(stored);
  }, []);

  const handleSavePreferences = (visible: string[]) => {
    setVisibleWidgets(visible);
    try {
      localStorage.setItem("ce_dashboard_visible_widgets", JSON.stringify(visible));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (lastFetchedAt === 0) return;
    const t = setInterval(() => {
      setLastUpdatedLabel(formatLastUpdated(Date.now() - lastFetchedAt));
    }, 60_000);
    return () => clearInterval(t);
  }, [lastFetchedAt]);

  const scrollToTopIssues = useCallback(() => {
    topIssuesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isEmpty =
    !loading &&
    data &&
    !data.summary?.total_feedback &&
    period === "30d";

  if (loading && !data) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Dashboard</h2>
        <div className="h-96 rounded-lg border border-gray-600 bg-gray-800/30 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Dashboard</h2>
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => fetchDashboard()}
          className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Dashboard</h2>
        <EmptyState
          title="Welcome to Context Engine!"
          message="Your dashboard will come alive once you add data."
          actions={
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => navigate("/settings")}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                Setup Product Wizard
              </button>
              <button
                onClick={() => navigate("/settings", { state: { tab: "upload" } })}
                className="px-4 py-2 border border-gray-600 text-gray-200 hover:bg-gray-800 rounded-lg"
              >
                Upload Data
              </button>
              <button
                type="button"
                onClick={() => openChatWithMessage("Generate specs for ")}
                className="px-4 py-2 text-indigo-400 hover:text-indigo-300 border border-indigo-500/50 rounded-lg hover:bg-indigo-500/10"
              >
                Generate specs
              </button>
              <button
                type="button"
                onClick={openChat}
                className="px-4 py-2 text-indigo-400 hover:text-indigo-300 border border-indigo-500/50 rounded-lg hover:bg-indigo-500/10"
              >
                Ask Context Engine
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Dashboard</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={period}
            onChange={(e) => {
              const v = e.target.value;
              setPeriod(v);
              const d = periodToDates(v === "custom" ? "30d" : v);
              setDateFrom(d.from);
              setDateTo(d.to);
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
          {period === "custom" && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 text-sm"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 text-sm"
              />
            </>
          )}
          <span className="text-sm text-gray-400">Last updated: {lastUpdatedLabel}</span>
          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <CustomizeDashboard visibleWidgets={visibleWidgets} onSave={handleSavePreferences} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleWidgets.includes("summary") && (
          <div className="lg:col-span-2">
            <SummaryCards
              data={data?.summary ?? null}
              loading={refreshing}
              onScrollToIssues={scrollToTopIssues}
            />
          </div>
        )}

        {visibleWidgets.includes("volume") && (
          <VolumeChart data={data?.volume_over_time ?? []} loading={refreshing} />
        )}
        {visibleWidgets.includes("sentiment") && (
          <SentimentDonut data={data?.sentiment_breakdown ?? null} loading={refreshing} />
        )}

        {visibleWidgets.includes("top_issues") && (
          <div ref={topIssuesRef}>
            <TopIssuesRice data={data?.top_issues_rice ?? []} loading={refreshing} />
          </div>
        )}
        {visibleWidgets.includes("at_risk") && (
          <AtRiskTable data={data?.at_risk_customers ?? []} loading={refreshing} />
        )}

        {visibleWidgets.includes("recent") && (
          <RecentFeedback data={data?.recent_feedback ?? []} loading={refreshing} />
        )}
        {visibleWidgets.includes("sources") && (
          <SourceDistribution data={data?.source_distribution ?? null} loading={refreshing} />
        )}

        {visibleWidgets.includes("areas") && (
          <AreaBreakdown data={data?.area_breakdown ?? null} loading={refreshing} />
        )}
        {visibleWidgets.includes("segments") && (
          <SegmentBreakdown data={data?.segment_breakdown ?? null} loading={refreshing} />
        )}
      </div>
    </div>
  );
}

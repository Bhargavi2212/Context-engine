import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getHealth, type HealthData } from "../services/api";
import { getHistory } from "../services/uploadApi";
import { getAgentStats, type AgentStats } from "../services/monitoringApi";
import { useAuth } from "../hooks/useAuth";
import ThemeToggle from "../components/layout/ThemeToggle";
import ProductWizard from "../components/wizard/ProductWizard";
import { FeedbackUpload, CustomerUpload, UploadHistoryTable } from "../components/upload";
import ConnectorsTab from "../components/connectors/ConnectorsTab";

type Tab = "product" | "upload" | "connectors" | "account" | "system";

export default function SettingsPage() {
  const { state } = useLocation();
  const initialTab = (state as { tab?: Tab } | null)?.tab;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "product");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [lastUploadSummary, setLastUploadSummary] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (activeTab === "system") {
      getAgentStats()
        .then(setAgentStats)
        .catch(() => setAgentStats(null));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "upload") {
      getHistory()
        .then((items) => {
          const completed = items.filter((u) => u.status === "completed");
          const lastFeedback = completed.filter((u) => u.upload_type === "feedback").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
          const lastCustomer = completed.filter((u) => u.upload_type === "customer" || u.upload_type === "customers").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
          const parts: string[] = [];
          if (lastFeedback) parts.push(`${lastFeedback.imported_rows ?? 0} feedback items`);
          if (lastCustomer) parts.push(`${lastCustomer.imported_rows ?? 0} customers`);
          setLastUploadSummary(parts.length > 0 ? `Last upload: ${parts.join(", ")}` : null);
        })
        .catch(() => setLastUploadSummary(null));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "system") {
      setHealthLoading(true);
      getHealth()
        .then((res) => setHealth(res.data))
        .catch(() => setHealth({ status: "error", database: "—", mistral: "—" }))
        .finally(() => setHealthLoading(false));
    }
  }, [activeTab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "product", label: "Product Wizard" },
    { id: "upload", label: "Data Upload" },
    { id: "connectors", label: "Connectors" },
    { id: "account", label: "Account" },
    { id: "system", label: "System Status" },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-gray-100 mb-6">Settings</h2>
      <div className="flex gap-4">
        <div className="w-48 flex flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-left ${
                activeTab === tab.id
                  ? "bg-blue-500 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 bg-gray-800 rounded-lg p-6 min-h-[300px]">
          {activeTab === "product" && (
            <ProductWizard mode="settings" />
          )}
          {activeTab === "upload" && (
            <div className="space-y-8">
              {lastUploadSummary && (
                <p className="text-sm text-gray-400">{lastUploadSummary}</p>
              )}
              <FeedbackUpload />
              <CustomerUpload />
              <UploadHistoryTable />
            </div>
          )}
          {activeTab === "connectors" && (
            <ConnectorsTab onNavigateToUpload={() => setActiveTab("upload")} />
          )}
          {activeTab === "account" && (
            <div className="space-y-4">
              {user && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Email
                    </label>
                    <p className="text-gray-100">{user.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Theme
                    </label>
                    <ThemeToggle />
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === "system" && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-100">Connection status</h3>
              {healthLoading ? (
                <p className="text-gray-400">Checking...</p>
              ) : health ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-gray-400">Status: </span>
                    <span
                      className={
                        health.status === "healthy"
                          ? "text-green-400"
                          : "text-yellow-400"
                      }
                    >
                      {health.status}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">Database: </span>
                    <span className="text-gray-100">{health.database}</span>
                  </p>
                  <p>
                    <span className="text-gray-400">Mistral: </span>
                    <span className="text-gray-100">{health.mistral}</span>
                    {health.mistral === "disconnected" && (
                      <span className="block text-gray-500 text-xs mt-1">
                        Set a valid MISTRAL_API_KEY in .env and restart the backend.
                      </span>
                    )}
                  </p>
                  {health.version && (
                    <p>
                      <span className="text-gray-400">Version: </span>
                      <span className="text-gray-100">{health.version}</span>
                    </p>
                  )}
                </div>
              ) : null}
              {activeTab === "system" && (
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <h3 className="font-medium text-gray-100 mb-3">Agent Monitoring</h3>
                  {agentStats ? (
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-400">Total calls: </span><span className="text-gray-100">{agentStats.total_calls}</span></p>
                      <p><span className="text-gray-400">Avg response time: </span><span className="text-gray-100">{agentStats.avg_latency_ms != null ? `${agentStats.avg_latency_ms} ms` : "—"}</span></p>
                      <p><span className="text-gray-400">Tool calls: </span><span className="text-gray-100">{Object.keys(agentStats.tool_counts).length ? Object.entries(agentStats.tool_counts).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}</span></p>
                      <p><span className="text-gray-400">Most used tool: </span><span className="text-gray-100">{agentStats.most_used_tool || "—"}</span></p>
                      <p><span className="text-gray-400">Model usage: </span><span className="text-gray-100">{Object.entries(agentStats.model_usage).map(([m, p]) => `${m}: ${p}%`).join(", ") || "—"}</span></p>
                      {agentStats.recent_activity?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-gray-400 mb-1">Recent activity</p>
                          <ul className="text-gray-300 space-y-0.5 max-h-32 overflow-y-auto">
                            {agentStats.recent_activity.slice(0, 5).map((r, i) => (
                              <li key={i}>{r.agent_type} · {r.latency_ms} ms · {r.created_at ? new Date(r.created_at).toLocaleTimeString() : ""}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <a href="https://smith.langchain.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 text-sm">Open LangSmith →</a>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No agent calls yet. Use the Context Engine chat to see stats.</p>
                  )}
                </div>
              )}
              {activeTab === "system" && !healthLoading && !health ? (
                <p className="text-gray-400">Failed to load health</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  listConnectors,
  connectSlack,
  updateConnector,
  disconnectConnector,
  syncConnector,
  getConnectorHistory,
  type Connector,
  type ConnectorHistoryItem,
} from "../../services/connectorsApi";

const DISCONNECT_MESSAGE =
  "This will stop automatic ingestion from Slack. Existing feedback won't be deleted.";

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
    return `${Math.floor(sec / 86400)} days ago`;
  } catch {
    return iso;
  }
}

function formatHistoryTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}

export default function ConnectorsTab({
  onNavigateToUpload,
}: {
  onNavigateToUpload: () => void;
}) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [slackConnectModal, setSlackConnectModal] = useState(false);
  const [slackConnectMode, setSlackConnectMode] = useState<"simulated" | "live">("simulated");
  const [slackConnectChannels, setSlackConnectChannels] = useState("");
  const [slackConnectInterval, setSlackConnectInterval] = useState(60);
  const [slackConnectBotToken, setSlackConnectBotToken] = useState("");
  const [slackConnectTeamId, setSlackConnectTeamId] = useState("");
  const [slackConnectSubmitting, setSlackConnectSubmitting] = useState(false);
  const [slackConnectEditingId, setSlackConnectEditingId] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [historyByConnector, setHistoryByConnector] = useState<Record<string, ConnectorHistoryItem[]>>({});

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConnectors();
      setConnectors(Array.isArray(res.data) ? res.data : []);
    } catch {
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const slackConnector = connectors.find((c) => c.type === "slack" && c.status === "connected");

  useEffect(() => {
    if (!slackConnector?.id) return;
    getConnectorHistory(slackConnector.id)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setHistoryByConnector((prev) => ({ ...prev, [slackConnector.id]: list }));
      })
      .catch(() => {});
  }, [slackConnector?.id]);

  const handleConnectSlack = async () => {
    setSlackConnectSubmitting(true);
    try {
      const channelList = slackConnectChannels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (slackConnectEditingId) {
        if (slackConnectMode !== "live") {
          await updateConnector(slackConnectEditingId, {
            channels: channelList.length ? channelList : ["product-feedback", "support-escalations"],
            poll_interval_seconds: slackConnectInterval,
          });
        }
      } else {
        if (slackConnectMode === "live") {
          const channelIds = channelList.length ? channelList : [];
          if (!slackConnectBotToken.trim() || !slackConnectTeamId.trim()) {
            throw new Error("Bot token and Team ID are required for Live Slack.");
          }
          if (!channelIds.length) {
            throw new Error("At least one channel ID is required (e.g. C01234ABC).");
          }
          await connectSlack({
            mode: "live",
            slack_bot_token: slackConnectBotToken.trim(),
            slack_team_id: slackConnectTeamId.trim(),
            channel_ids: channelIds,
            poll_interval_seconds: slackConnectInterval,
          });
        } else {
          await connectSlack({
            mode: "simulated",
            channels: channelList.length ? channelList : ["product-feedback", "support-escalations"],
            poll_interval_seconds: slackConnectInterval,
          });
        }
      }
      setSlackConnectModal(false);
      setSlackConnectChannels("");
      setSlackConnectInterval(60);
      setSlackConnectBotToken("");
      setSlackConnectTeamId("");
      setSlackConnectEditingId(null);
      await fetchConnectors();
    } catch (e) {
      console.error(e);
    } finally {
      setSlackConnectSubmitting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectConnector(id);
      setDisconnectConfirm(null);
      await fetchConnectors();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await syncConnector(id);
      await fetchConnectors();
      if (slackConnector?.id === id) {
        getConnectorHistory(id).then((res) => {
          setHistoryByConnector((prev) => ({ ...prev, [id]: Array.isArray(res.data) ? res.data : [] }));
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) {
    return <p className="text-gray-400">Loading connectors...</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-400">Connect data sources for feedback monitoring.</p>

      {/* CSV / Manual Upload card */}
      <div className="rounded-lg border border-gray-600 bg-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-100">CSV / Manual Upload</span>
          <span className="text-xs text-green-400 font-medium">Always On</span>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Upload feedback or customer CSVs anytime. Each item is classified, embedded, and linked.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
          >
            Upload Feedback CSV
          </button>
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
          >
            Upload Customer CSV
          </button>
        </div>
      </div>

      {/* Slack card */}
      <div className="rounded-lg border border-gray-600 bg-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-100">Slack (MCP)</span>
          {slackConnector ? (
            <span className="text-xs text-green-400 font-medium">
              Active{(slackConnector.config as { mode?: string })?.mode === "live" ? " (Live)" : ""}
            </span>
          ) : (
            <span className="text-xs text-gray-500">Disconnected</span>
          )}
        </div>
        {slackConnector ? (
          <>
            <div className="text-sm text-gray-400 space-y-1 mb-3">
              <p>
                Channels:{" "}
                {(slackConnector.channels?.length
                  ? slackConnector.channels.map((c) => `#${c}`).join(", ")
                  : "—") || "—"}
              </p>
              <p>Last sync: {formatTimeAgo(slackConnector.last_sync_at)}</p>
              <p>
                Messages processed: {slackConnector.messages_processed}
                {slackConnector.noise_filtered != null && slackConnector.noise_filtered > 0
                  ? ` (${slackConnector.noise_filtered} noise filtered)`
                  : ""}
              </p>
              <p>
                Polling every: {slackConnector.poll_interval_seconds ?? 60} seconds
              </p>
              {slackConnector.last_error && (
                <p className="text-amber-400 text-sm">Error: {slackConnector.last_error}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSync(slackConnector.id)}
                disabled={syncingId === slackConnector.id}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {syncingId === slackConnector.id ? "Syncing…" : "Sync Now"}
              </button>
              {(slackConnector.config as { mode?: string })?.mode !== "live" && (
                <button
                  type="button"
                  onClick={() => {
                    setSlackConnectMode("simulated");
                    setSlackConnectChannels(
                      (slackConnector.channels ?? []).join(", ")
                    );
                    setSlackConnectInterval(
                      slackConnector.poll_interval_seconds ?? 60
                    );
                    setSlackConnectEditingId(slackConnector.id);
                    setSlackConnectModal(true);
                  }}
                  className="px-3 py-1.5 rounded bg-gray-600 text-white text-sm hover:bg-gray-500"
                >
                  Configure
                </button>
              )}
              <button
                type="button"
                onClick={() => setDisconnectConfirm(slackConnector.id)}
                className="px-3 py-1.5 rounded bg-red-600/80 text-white text-sm hover:bg-red-500"
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-3">
              Connect Slack to pull messages from channels and run them through the classification pipeline.
            </p>
            <button
              type="button"
              onClick={() => {
                setSlackConnectEditingId(null);
                setSlackConnectMode("simulated");
                setSlackConnectChannels("");
                setSlackConnectInterval(60);
                setSlackConnectBotToken("");
                setSlackConnectTeamId("");
                setSlackConnectModal(true);
              }}
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
            >
              Connect
            </button>
          </>
        )}
      </div>

      {/* Jira */}
      <div className="rounded-lg border border-gray-600 bg-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-100">Jira</span>
          <span className="text-xs text-gray-500">Coming Soon</span>
        </div>
        <p className="text-sm text-gray-400">Auto-import tickets as feedback</p>
      </div>

      {/* Salesforce */}
      <div className="rounded-lg border border-gray-600 bg-gray-700/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-100">Salesforce</span>
          <span className="text-xs text-gray-500">Coming Soon</span>
        </div>
        <p className="text-sm text-gray-400">Keep customer data in sync</p>
      </div>

      {/* Recent Activity */}
      {slackConnector && (
        <div className="pt-4 border-t border-gray-600">
          <h3 className="text-sm font-medium text-gray-300 mb-2">—— Recent Activity ——</h3>
          <ul className="space-y-1 text-sm text-gray-400">
            {(historyByConnector[slackConnector.id] ?? []).length === 0 && (
              <li>No activity yet.</li>
            )}
            {(historyByConnector[slackConnector.id] ?? []).map((h) => (
              <li key={h.id}>
                {formatHistoryTime(h.created_at)}{" "}
                {h.event_type === "started"
                  ? "Connector started"
                  : `Synced ${h.messages_count} new message${h.messages_count !== 1 ? "s" : ""}${
                      h.channel_or_detail ? ` from ${h.channel_or_detail}` : ""
                    }${h.noise_filtered > 0 ? ` (${h.noise_filtered} noise filtered)` : ""}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Connect Slack modal */}
      {slackConnectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => !slackConnectSubmitting && setSlackConnectModal(false)}>
          <div
            className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-gray-100 mb-4">
              {slackConnectEditingId ? "Configure Slack" : "Connect Slack"}
            </h3>
            {!slackConnectEditingId && (
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setSlackConnectMode("simulated")}
                  className={`px-3 py-1.5 rounded text-sm ${slackConnectMode === "simulated" ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300 hover:bg-gray-500"}`}
                >
                  Demo mode
                </button>
                <button
                  type="button"
                  onClick={() => setSlackConnectMode("live")}
                  className={`px-3 py-1.5 rounded text-sm ${slackConnectMode === "live" ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300 hover:bg-gray-500"}`}
                >
                  Live Slack
                </button>
              </div>
            )}
            {slackConnectMode === "live" && !slackConnectEditingId && (
              <div className="space-y-3 mb-4">
                <label className="block text-sm text-gray-400">
                  Slack Bot Token (xoxb-…)
                  <input
                    type="password"
                    value={slackConnectBotToken}
                    onChange={(e) => setSlackConnectBotToken(e.target.value)}
                    placeholder="xoxb-…"
                    className="mt-1 block w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-400">
                  Team ID
                  <input
                    type="text"
                    value={slackConnectTeamId}
                    onChange={(e) => setSlackConnectTeamId(e.target.value)}
                    placeholder="T01234ABCD"
                    className="mt-1 block w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-400">
                  Channel IDs (comma-separated)
                  <input
                    type="text"
                    value={slackConnectChannels}
                    onChange={(e) => setSlackConnectChannels(e.target.value)}
                    placeholder="C01234ABC, C05678DEF"
                    className="mt-1 block w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-400">
                  Poll interval
                  <select
                    value={slackConnectInterval}
                    onChange={(e) => setSlackConnectInterval(Number(e.target.value))}
                    className="mt-1 block w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </label>
              </div>
            )}
            {(slackConnectMode === "simulated" || slackConnectEditingId) && (
              <>
                <p className="text-sm text-gray-400 mb-2">Demo mode (simulated feed)</p>
                <div className="space-y-3 mb-4">
                  <label className="block text-sm text-gray-400">
                    Channels (comma-separated)
                    <input
                      type="text"
                      value={slackConnectChannels}
                      onChange={(e) => setSlackConnectChannels(e.target.value)}
                      placeholder="product-feedback, support-escalations"
                      className="mt-1 block w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-400">
                    Poll interval
                    <select
                      value={slackConnectInterval}
                      onChange={(e) => setSlackConnectInterval(Number(e.target.value))}
                      className="mt-1 block w-full rounded bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 text-sm"
                    >
                      <option value={30}>30 seconds</option>
                      <option value={60}>60 seconds</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSlackConnectModal(false)}
                disabled={slackConnectSubmitting}
                className="px-3 py-1.5 rounded bg-gray-600 text-white text-sm hover:bg-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnectSlack}
                disabled={slackConnectSubmitting}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {slackConnectSubmitting
                  ? slackConnectEditingId
                    ? "Saving…"
                    : "Connecting…"
                  : slackConnectEditingId
                    ? "Save"
                    : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect confirmation */}
      {disconnectConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDisconnectConfirm(null)}>
          <div
            className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-100 mb-4">{DISCONNECT_MESSAGE}</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDisconnectConfirm(null)}
                className="px-3 py-1.5 rounded bg-gray-600 text-white text-sm hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDisconnect(disconnectConfirm)}
                className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-500"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { getHistory, getStatus } from "../../services/uploadApi";
import type { UploadHistoryItem } from "../../types/upload";

const POLL_INTERVAL_MS = 2000;

export default function UploadHistoryTable() {
  const [items, setItems] = useState<UploadHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgress, setInProgress] = useState<Set<string>>(new Set());

  const fetchHistory = async () => {
    try {
      const data = await getHistory();
      setItems(data);
      const ids = data.filter((u) => u.status === "in_progress" || u.status === "pending").map((u) => u.upload_id);
      setInProgress(new Set(ids));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (inProgress.size === 0) return;
    const timer = setInterval(async () => {
      const next = new Set<string>();
      for (const id of inProgress) {
        const res = await getStatus(id);
        if (res.status === "completed" || res.status === "failed") {
          // stop polling this one
        } else {
          next.add(id);
        }
      }
      setInProgress(next);
      if (next.size === 0 || next.size < inProgress.size) {
        fetchHistory();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [inProgress.size]);

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleString() : "—");
  const statusColor = (s: string) => {
    if (s === "completed") return "text-green-400";
    if (s === "failed") return "text-red-400";
    if (s === "in_progress") return "text-blue-400";
    return "text-gray-400";
  };

  if (loading) {
    return <p className="text-gray-400">Loading upload history…</p>;
  }
  if (items.length === 0) {
    return <p className="text-gray-400">No uploads yet.</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-gray-100">Upload History</h3>
      <div className="overflow-x-auto rounded border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-left text-gray-400">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Filename</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.upload_id} className="border-t border-gray-700">
                <td className="px-3 py-2 text-gray-200">{formatDate(u.created_at)}</td>
                <td className="px-3 py-2 text-gray-200 capitalize">{u.upload_type}</td>
                <td className="px-3 py-2 text-gray-200 truncate max-w-[180px]" title={u.filename}>
                  {u.filename}
                </td>
                <td className="px-3 py-2 text-gray-200">
                  {u.status === "completed" || u.status === "failed"
                    ? `${u.imported_rows ?? u.processed ?? 0} / ${u.total_rows}`
                    : `${u.processed ?? 0} / ${u.total_rows}`}
                </td>
                <td className={`px-3 py-2 ${statusColor(u.status)}`}>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

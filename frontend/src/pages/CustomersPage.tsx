import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { listCustomers, deleteCustomer, mergeDuplicateCustomers } from "../services/customerApi";
import type { Customer } from "../types/customer";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ManualCustomerForm from "../components/customers/ManualCustomerForm";

function formatCurrency(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function daysToRenewal(renewalDate: string | undefined): number | null {
  if (!renewalDate) return null;
  const r = new Date(renewalDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  r.setHours(0, 0, 0, 0);
  return Math.ceil((r.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SortKey = "company_name" | "segment" | "arr" | "health_score" | "renewal_date" | "feedback_count" | "avg_sentiment";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<string>("");
  const [healthMin, setHealthMin] = useState<number | "">("");
  const [healthMax, setHealthMax] = useState<number | "">("");
  const [renewalWithinDays, setRenewalWithinDays] = useState<number | "">("");
  const [sortBy, setSortBy] = useState<SortKey>("company_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showManual, setShowManual] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCustomers({
        search: search || undefined,
        segment: segment || undefined,
        health_min: healthMin !== "" ? healthMin : undefined,
        health_max: healthMax !== "" ? healthMax : undefined,
        renewal_within_days: renewalWithinDays !== "" ? renewalWithinDays : undefined,
        page,
        per_page: 20,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, segment, healthMin, healthMax, renewalWithinDays, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const isEmpty = !loading && total === 0;

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const handleDeleteCustomer = async (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    if (!window.confirm(`Delete customer "${c.company_name}"? Their feedback will be unlinked (not deleted).`)) return;
    setDeletingId(c.id);
    try {
      await deleteCustomer(c.id);
      await fetchCustomers();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  const handleMergeDuplicates = async () => {
    if (!window.confirm("Merge duplicate customers? For each company name with multiple rows, one will be kept and feedback reassigned. This cannot be undone.")) return;
    setMerging(true);
    try {
      const result = await mergeDuplicateCustomers();
      await fetchCustomers();
      alert(`Merged ${result.merged_count} companies; ${result.deleted_count} duplicate row(s) removed.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  const segments = ["enterprise", "smb", "trial", "consumer"] as const;
  const renewalPresets = [
    { label: "Next 30 days", days: 30 },
    { label: "Next 60 days", days: 60 },
    { label: "Next 90 days", days: 90 },
  ] as const;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-gray-100">Customers</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMergeDuplicates}
            disabled={merging || total === 0}
            className="px-3 py-1.5 text-sm rounded bg-amber-600/80 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {merging ? "Merging…" : "Merge duplicate customers"}
          </button>
          <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate("/settings", { state: { tab: "upload" } })}
            className="px-4 py-2 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500"
          >
            Upload Customers
          </button>
          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Add Manually
          </button>
          </div>
        </div>
      </div>
      {showManual && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <ManualCustomerForm
            onSuccess={() => fetchCustomers()}
            onCancel={() => setShowManual(false)}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input
          type="search"
          placeholder="Search customers by company name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500"
        />
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="px-3 py-2 rounded border border-gray-600 bg-gray-800 text-gray-200"
        >
          <option value="">All segments</option>
          {segments.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Health min"
          min={0}
          max={100}
          value={healthMin}
          onChange={(e) => setHealthMin(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-24 px-3 py-2 rounded border border-gray-600 bg-gray-800 text-gray-200"
        />
        <input
          type="number"
          placeholder="Health max"
          min={0}
          max={100}
          value={healthMax}
          onChange={(e) => setHealthMax(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-24 px-3 py-2 rounded border border-gray-600 bg-gray-800 text-gray-200"
        />
        <div className="flex gap-1">
          {renewalPresets.map(({ label: l, days }) => (
            <button
              key={days}
              type="button"
              onClick={() => setRenewalWithinDays(renewalWithinDays === days ? "" : days)}
              className={`px-2 py-1 rounded text-xs ${
                renewalWithinDays === days ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="No customers yet"
          message="Upload your customer list to link feedback and track health."
          primaryButton={{
            label: "Upload Customers",
            onClick: () => navigate("/settings", { state: { tab: "upload" } }),
          }}
          secondaryButton={{
            label: "Add Manually",
            onClick: () => setShowManual(true),
          }}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-left text-gray-400">
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-gray-200"
                    onClick={() => handleSort("company_name")}
                  >
                    Company {sortBy === "company_name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-gray-200"
                    onClick={() => handleSort("segment")}
                  >
                    Segment {sortBy === "segment" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-gray-200"
                    onClick={() => handleSort("arr")}
                  >
                    ARR {sortBy === "arr" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-gray-200"
                    onClick={() => handleSort("health_score")}
                  >
                    Health {sortBy === "health_score" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-gray-200"
                    onClick={() => handleSort("renewal_date")}
                  >
                    Renewal {sortBy === "renewal_date" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-gray-200"
                    onClick={() => handleSort("feedback_count")}
                  >
                    Feedback {sortBy === "feedback_count" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-gray-200"
                    onClick={() => handleSort("avg_sentiment")}
                  >
                    Avg Sentiment {sortBy === "avg_sentiment" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-4 py-3 text-gray-400 w-12">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const days = daysToRenewal(c.renewal_date);
                  const renewalUrgency =
                    days != null && days >= 0 && days <= 30
                      ? "text-red-400"
                      : days != null && days >= 0 && days <= 60
                        ? "text-orange-400"
                        : "text-gray-300";
                  const healthScore = c.health_score ?? 50;
                  const healthBarColor =
                    healthScore >= 70
                      ? "bg-green-500"
                      : healthScore >= 40
                        ? "bg-yellow-500"
                        : "bg-red-500";
                  const avgSentiment = c.avg_sentiment;
                  const sentimentDot =
                    avgSentiment == null
                      ? "text-gray-500"
                      : avgSentiment > 0.2
                        ? "text-green-400"
                        : avgSentiment < -0.2
                          ? "text-red-400"
                          : "text-gray-400";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="border-t border-gray-700 hover:bg-gray-800/50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-gray-100 font-medium">{c.company_name}</td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{c.segment ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-300">{formatCurrency(c.arr)}</td>
                      <td className="px-4 py-3">
                        <div className="w-20 h-2 bg-gray-700 rounded overflow-hidden">
                          <div
                            className={`h-full ${healthBarColor}`}
                            style={{ width: `${Math.max(0, Math.min(100, healthScore))}%` }}
                          />
                        </div>
                      </td>
                      <td className={`px-4 py-3 ${renewalUrgency}`}>
                        {days != null && days >= 0
                          ? `in ${days} days`
                          : formatDate(c.renewal_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{c.feedback_count ?? 0}</td>
                      <td className={`px-4 py-3 ${sentimentDot}`}>
                        {avgSentiment != null ? avgSentiment.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomer(e, c)}
                          disabled={deletingId === c.id}
                          className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                          aria-label="Delete customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > 20 && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded bg-gray-600 text-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="py-1 text-gray-400 text-sm">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-1 rounded bg-gray-600 text-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

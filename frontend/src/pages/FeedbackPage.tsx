import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listFeedback, searchFeedback, mergeDuplicateFeedback, getFeedback } from "../services/feedbackApi";
import type { Feedback } from "../types/feedback";
import type { FeedbackFilters } from "../components/feedback/FilterBar";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { SearchBar } from "../components/feedback/SearchBar";
import { FilterBar } from "../components/feedback/FilterBar";
import { FeedbackCard } from "../components/feedback/FeedbackCard";
import { FeedbackDetailPanel } from "../components/feedback/FeedbackDetailPanel";
import ManualFeedbackForm from "../components/feedback/ManualFeedbackForm";
import { useAgentChat } from "../contexts/AgentChatContext";

type FeedbackToggle = "feedback_only" | "show_all" | "noise_only";

function feedbackToggleToIsFeedback(t: FeedbackToggle): boolean | undefined {
  if (t === "feedback_only") return true;
  if (t === "noise_only") return false;
  return undefined;
}

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { openChat } = useAgentChat();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<FeedbackFilters>(() => {
    const f: FeedbackFilters = {};
    const q = searchParams.get("q");
    const area = searchParams.get("area");
    const sentiment = searchParams.get("sentiment");
    const source = searchParams.get("source");
    const segment = searchParams.get("segment");
    const urgency = searchParams.get("urgency");
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    if (area) f.product_area = area;
    if (sentiment) f.sentiment = sentiment;
    if (source) f.source = source;
    if (segment) f.customer_segment = segment;
    if (urgency) f.urgency = urgency;
    if (type) f.feedback_type = type;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  });
  const [toggle, setToggle] = useState<FeedbackToggle>(
    (searchParams.get("view") as FeedbackToggle) ?? "feedback_only"
  );
  const [showManual, setShowManual] = useState(false);
  const [detailFeedback, setDetailFeedback] = useState<Feedback | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filters.product_area) params.set("area", filters.product_area);
    if (filters.sentiment) params.set("sentiment", filters.sentiment);
    if (filters.source) params.set("source", filters.source);
    if (filters.customer_segment) params.set("segment", filters.customer_segment);
    if (filters.urgency) params.set("urgency", filters.urgency);
    if (filters.feedback_type) params.set("type", filters.feedback_type);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    params.set("view", toggle);
    setSearchParams(params, { replace: true });
  }, [search, filters, toggle, setSearchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const isFeedback = feedbackToggleToIsFeedback(toggle);
    try {
      if (search.trim()) {
        const res = await searchFeedback({
          q: search.trim(),
          product_area: filters.product_area,
          sentiment: filters.sentiment,
          source: filters.source,
          customer_segment: filters.customer_segment,
          urgency: filters.urgency,
          feedback_type: filters.feedback_type,
          is_feedback: isFeedback,
          date_from: filters.date_from,
          date_to: filters.date_to,
          limit: 50,
        });
        setItems(res.data);
        setTotal(res.total);
      } else {
        const res = await listFeedback({
          product_area: filters.product_area,
          sentiment: filters.sentiment,
          source: filters.source,
          customer_segment: filters.customer_segment,
          urgency: filters.urgency,
          is_feedback: isFeedback,
          date_from: filters.date_from,
          date_to: filters.date_to,
          page,
          per_page: 20,
        });
        setItems(res.data);
        setTotal(res.total);
      }
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, filters, toggle, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const highlightId = searchParams.get("highlight");
  useEffect(() => {
    if (!highlightId || loading) return;
    const found = items.find((f) => f.id === highlightId);
    if (found) {
      setDetailFeedback(found);
      return;
    }
    getFeedback(highlightId)
      .then(setDetailFeedback)
      .catch(() => {});
  }, [highlightId, loading, items]);

  const handleMergeDuplicates = async () => {
    if (
      !window.confirm(
        "Merge duplicate feedback? Items with the same text will be collapsed into one. Specs will be updated to point to the kept item. This cannot be undone."
      )
    )
      return;
    setMerging(true);
    try {
      const result = await mergeDuplicateFeedback();
      await fetchData();
      if (detailFeedback && result.deleted_count > 0) setDetailFeedback(null);
      alert(
        `Merged ${result.merged_count} duplicate group(s); ${result.deleted_count} row(s) removed.`
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  const isEmpty = !loading && total === 0;
  const isSearching = search.trim().length > 0;

  return (
    <div className="p-8 flex gap-6 flex-1 min-w-0 min-h-0">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Feedback</h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleMergeDuplicates}
            disabled={merging || total === 0}
            className="px-3 py-1.5 text-sm rounded bg-amber-600/80 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {merging ? "Merging…" : "Merge duplicate feedback"}
          </button>
          <button
            type="button"
            onClick={() => openChat()}
            className="px-3 py-1.5 text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/50 rounded-lg hover:bg-indigo-500/10"
          >
            Ask Context Engine
          </button>
          <select
            value={toggle}
            onChange={(e) => setToggle(e.target.value as FeedbackToggle)}
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            title="Filter by feedback type"
          >
            <option value="feedback_only">Feedback only</option>
            <option value="show_all">Show all</option>
            <option value="noise_only">Noise only</option>
          </select>
          <button
            type="button"
            onClick={() => navigate("/settings", { state: { tab: "upload" } })}
            className="px-4 py-2 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500"
          >
            Upload CSV
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
      {showManual && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <ManualFeedbackForm
            onSuccess={() => fetchData()}
            onCancel={() => setShowManual(false)}
          />
        </div>
      )}
      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>
      <div className="mb-4">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : isEmpty ? (
        isSearching ? (
          <EmptyState
            title="No results found"
            message="Try different search terms or clear filters to see more feedback."
            primaryButton={{
              label: "Clear search",
              onClick: () => {
                setSearch("");
                setFilters({});
              },
            }}
          />
        ) : (
          <EmptyState
            title="No feedback yet"
            message="Upload a CSV or add feedback manually to get started."
            primaryButton={{
              label: "Upload CSV",
              onClick: () => navigate("/settings", { state: { tab: "upload" } }),
            }}
            secondaryButton={{
              label: "Add Manually",
              onClick: () => setShowManual(true),
            }}
          />
        )
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                onClick={() => setDetailFeedback(item)}
                isSearchMode={isSearching}
              />
            ))}
          </div>
          {!isSearching && total > 20 && (
            <div className="mt-4 flex gap-2 items-center">
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
      </div>
      {detailFeedback && (
        <FeedbackDetailPanel
          feedback={detailFeedback}
          onClose={() => setDetailFeedback(null)}
          onSelectSimilar={(f) => setDetailFeedback(f)}
          onDeleted={() => {
            setDetailFeedback(null);
            fetchData();
          }}
          inline
        />
      )}
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import { ArrowLeft, Download, RefreshCw, Trash2, CheckCircle, Copy, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import { getSpec, updateSpecStatus, deleteSpec, regenerateSpec } from "../services/specsApi";
import { getCustomer } from "../services/customerApi";
import type { SpecDetail } from "../types/specs";

function formatDate(created_at: string): string {
  try {
    return new Date(created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return created_at;
  }
}

function formatArr(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

/** Post-process markdown: make "[→ View feedback]" and customer names clickable. */
function markdownWithCitations(
  raw: string,
  feedbackIds: string[],
  customerNameToId: Record<string, string>
): string {
  if (!raw) return "";
  let out = raw;
  // Replace "[→ View feedback]" with link to feedback (use feedback_ids in order)
  let feedbackIndex = 0;
  out = out.replace(/\[\s*→\s*View feedback\s*\]/gi, () => {
    const id = feedbackIds[feedbackIndex];
    feedbackIndex += 1;
    if (id) return `[→ View feedback](/feedback?highlight=${encodeURIComponent(id)})`;
    return "[→ View feedback]";
  });
  // Replace customer names with links (longest first to avoid partial matches)
  const names = Object.keys(customerNameToId).filter(Boolean);
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const id = customerNameToId[name];
    if (!id) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b(${escaped})\\b`, "g");
    out = out.replace(re, `[$1](/customers/${id})`);
  }
  return out;
}

type TabId = "prd" | "architecture" | "rules" | "plan";

const TABS: { id: TabId; label: string; key: keyof SpecDetail }[] = [
  { id: "prd", label: "PRD", key: "prd" },
  { id: "architecture", label: "Architecture", key: "architecture" },
  { id: "rules", label: "Rules", key: "rules" },
  { id: "plan", label: "Implementation", key: "plan" },
];

export default function SpecDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [spec, setSpec] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("prd");
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [customerNameToId, setCustomerNameToId] = useState<Record<string, string>>({});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    if (!id) return;
    getSpec(id)
      .then(setSpec)
      .catch(() => setSpec(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!spec?.customer_ids?.length) {
      setCustomerNameToId({});
      return;
    }
    const map: Record<string, string> = {};
    Promise.all(
      spec.customer_ids.map((cid) =>
        getCustomer(cid)
          .then((c) => {
            if (c?.company_name) map[c.company_name] = c.id;
          })
          .catch(() => {})
      )
    ).then(() => setCustomerNameToId(map));
  }, [spec?.customer_ids]);

  const currentContent = useMemo(() => {
    if (!spec) return "";
    const key = TABS.find((t) => t.id === activeTab)?.key;
    const raw = (key && spec[key]) ? String(spec[key]) : "";
    return markdownWithCitations(
      raw,
      spec.feedback_ids ?? [],
      customerNameToId
    );
  }, [spec, activeTab, customerNameToId]);

  const handleMarkFinal = () => {
    if (!id || !spec) return;
    updateSpecStatus(id, "final")
      .then(setSpec)
      .catch(() => {});
  };

  const handleRegenerate = () => {
    if (!id || !spec) return;
    setRegenerating(true);
    regenerateSpec(id)
      .then((updated) => {
        setSpec(updated);
        toast.success("Spec regenerated");
      })
      .catch(() => toast.error("Regeneration failed"))
      .finally(() => setRegenerating(false));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      showToast("Copied to clipboard");
    } catch {
      showToast("Copy failed");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard");
    } catch {
      showToast("Copy failed");
    }
  };

  const handleDownloadTab = () => {
    const filename = `${activeTab}.md`;
    const blob = new Blob([currentContent], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Downloaded ${filename}`);
  };

  const handleDownloadAll = async () => {
    if (!spec) return;
    const zip = new JSZip();
    zip.file("prd.md", spec.prd ?? "");
    zip.file("architecture.md", spec.architecture ?? "");
    zip.file("rules.md", spec.rules ?? "");
    zip.file("plan.md", spec.plan ?? "");
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `spec-${spec.topic.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Downloaded all as zip");
  };

  const handleDownload = () => {
    if (!spec) return;
    const parts = [
      `# ${spec.topic}\n\n`,
      "## PRD\n\n", spec.prd ?? "", "\n\n",
      "## Architecture\n\n", spec.architecture ?? "", "\n\n",
      "## Engineering Rules\n\n", spec.rules ?? "", "\n\n",
      "## Implementation Plan\n\n", spec.plan ?? "",
    ];
    const blob = new Blob(parts.join(""), { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `spec-${spec.topic.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Downloaded");
  };

  const handleDelete = () => {
    if (!id || !window.confirm("Delete this spec? This cannot be undone.")) return;
    setDeleting(true);
    deleteSpec(id)
      .then(() => navigate("/specs"))
      .catch(() => {})
      .finally(() => setDeleting(false));
  };

  if (loading || !id) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Spec not found.</p>
        <Link to="/specs" className="text-indigo-400 hover:underline mt-2 inline-block">
          Back to Specs
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 flex gap-8">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <Link
            to="/specs"
            className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-200 mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Specs
          </Link>
          <h1 className="text-2xl font-semibold text-gray-100">{spec.topic}</h1>
        </div>

        <div className="flex gap-2 border-b border-gray-700 mb-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
          >
            <Download className="w-4 h-4" /> Download All
          </button>
          <button
            type="button"
            onClick={handleDownloadTab}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
          >
            <Download className="w-4 h-4" /> Download Tab
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
          >
            <Copy className="w-4 h-4" /> Copy
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-gray-200"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} /> Regenerate
          </button>
          {spec.status !== "final" && (
            <button
              type="button"
              onClick={handleMarkFinal}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 rounded text-white"
            >
              <CheckCircle className="w-4 h-4" /> Mark as Final
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
          >
            <Download className="w-4 h-4" /> Download (.md)
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-900/50 hover:bg-red-800/50 disabled:opacity-50 rounded text-red-300"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>

        <div className="max-w-none text-gray-100 min-h-[300px] [&_h1]:!text-xl [&_h1]:!font-bold [&_h2]:!text-lg [&_h2]:!font-semibold [&_h2]:!mt-6 [&_h3]:!text-base [&_h3]:!font-semibold [&_h3]:!mt-4 [&_p]:!text-gray-200 [&_p]:my-2 [&_li]:!text-gray-200 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_td]:!text-gray-200 [&_th]:!text-gray-300 [&_th]:!font-medium [&_table]:border-gray-600 [&_th]:border [&_td]:border [&_code]:!text-gray-300 [&_code]:bg-gray-800 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-gray-800 [&_pre]:!text-gray-200 [&_pre]:p-4 [&_pre]:rounded [&_blockquote]:border-l-4 [&_blockquote]:border-gray-500 [&_blockquote]:pl-4 [&_blockquote]:!text-gray-300 [&_hr]:!border-gray-600">
          {!currentContent.trim() ? (
            <p className="text-gray-500 py-8">No content for this section yet. Use Regenerate to generate the spec.</p>
          ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                if (href && (href.startsWith("/feedback") || href.startsWith("/customers"))) {
                  return (
                    <Link to={href} className="!text-indigo-400 hover:!text-indigo-300 hover:underline">
                      {children}
                    </Link>
                  );
                }
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="!text-indigo-400 hover:!text-indigo-300 hover:underline">
                    {children}
                  </a>
                );
              },
            }}
          >
            {currentContent}
          </ReactMarkdown>
          )}
        </div>
      </div>

      {/* Sidebar metadata — show "—" when value is 0 or missing so it reads as "no data" */}
      <aside className="w-64 shrink-0 space-y-4">
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 space-y-2 text-sm">
          <p><span className="text-gray-500">Date:</span> {formatDate(spec.created_at)}</p>
          <p><span className="text-gray-500">Status:</span> <span className={spec.status === "final" ? "text-green-400" : spec.status === "shared" ? "text-blue-400" : "text-amber-400"}>{spec.status}</span></p>
          <p><span className="text-gray-500">RICE:</span> {spec.rice_score != null && spec.rice_score > 0 ? spec.rice_score : "—"}</p>
          <p><span className="text-gray-500">ARR impacted:</span> {spec.arr_impacted != null && spec.arr_impacted > 0 ? formatArr(spec.arr_impacted) : "—"}</p>
          <p><span className="text-gray-500">Feedback items:</span> {((spec.feedback_count ?? spec.feedback_ids?.length ?? 0) > 0) ? (spec.feedback_count ?? spec.feedback_ids?.length ?? 0) : "—"}</p>
          <p><span className="text-gray-500">Customers cited:</span> {(spec.customer_ids?.length ?? 0) > 0 ? (spec.customer_ids?.length ?? 0) : "—"}</p>
        </div>
      </aside>

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded bg-gray-800 border border-gray-600 text-gray-100 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

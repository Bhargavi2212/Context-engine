import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { parseFeedback, importFeedback, getStatus } from "../../services/uploadApi";
import { FEEDBACK_SOURCES } from "../../types/feedback";

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm text-gray-400 mb-1";

const FEEDBACK_FIELDS = [
  { key: "text", label: "Feedback text *", required: true },
  { key: "author_name", label: "Author name", required: false },
  { key: "customer_name", label: "Company / Customer", required: false },
  { key: "source", label: "Source", required: false },
  { key: "rating", label: "Rating", required: false },
  { key: "created_at", label: "Date", required: false },
];

const POLL_INTERVAL_MS = 1500;

export default function FeedbackUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [defaultSource, setDefaultSource] = useState("support_ticket");
  const [useTodayForDate, setUseTodayForDate] = useState(true);
  const [importing, setImporting] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<{
    imported_rows: number;
    failed_rows: number;
    result_data?: { sentiment_breakdown?: Record<string, number>; top_areas?: { area: string; count: number }[] };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollStatus = useCallback(async (id: string) => {
    const res = await getStatus(id);
    setProcessed(res.processed);
    setStatus(res.status);
    if (res.status === "completed" || res.status === "failed") {
      const imported = res.imported_rows ?? res.processed ?? 0;
      const failed = res.failed_rows ?? 0;
      setResult({
        imported_rows: imported,
        failed_rows: failed,
        result_data: res.result_data,
      });
      setImporting(false);
      if (res.status === "completed") toast.success(`Upload complete: ${imported} feedback items imported`);
      else toast.error("Upload failed");
      return;
    }
    setTimeout(() => pollStatus(id), POLL_INTERVAL_MS);
  }, []);

  const processFile = async (f: File) => {
    if (!f?.name.toLowerCase().endsWith(".csv") && !f?.name.toLowerCase().endsWith(".tsv")) {
      setError("Please select a CSV or TSV file");
      return;
    }
    setError(null);
    setResult(null);
    try {
      const parsed = await parseFeedback(f);
      setFile(f);
      setUploadId(parsed.upload_id);
      setColumns(parsed.columns);
      setMapping(parsed.suggested_mapping || {});
      setPreview(parsed.preview || []);
      setTotalRows(parsed.rows);
      if (!parsed.suggested_mapping?.text) {
        setMapping((m) => ({ ...m, text: parsed.columns[0] || "" }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleConfirmAndImport = async () => {
    if (!uploadId || !mapping.text) {
      setError("Feedback text column is required");
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      await importFeedback({
        upload_id: uploadId,
        column_mapping: mapping,
        default_source: defaultSource,
        use_today_for_date: useTodayForDate,
      });
      setStatus("in_progress");
      setProcessed(0);
      pollStatus(uploadId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setError(msg);
      setImporting(false);
      toast.error(msg);
    }
  };

  const reset = () => {
    setFile(null);
    setUploadId(null);
    setColumns([]);
    setMapping({});
    setPreview([]);
    setTotalRows(0);
    setResult(null);
    setProcessed(0);
    setStatus("");
    setError(null);
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <h3 className="font-medium text-gray-100">Feedback CSV Upload</h3>
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {!uploadId ? (
        <label
          htmlFor="feedback-csv-input"
          className="block border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 cursor-pointer transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            id="feedback-csv-input"
            type="file"
            accept=".csv,.tsv"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-gray-400">Drop CSV or TSV file or click to browse</p>
        </label>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {totalRows} rows • {file?.name}
          </p>
          {!mapping.text && (
            <p className="text-yellow-400 text-sm">Feedback text column is required. Map it below.</p>
          )}
          <div>
            <label className={labelClass}>Default source (when not in CSV)</label>
            <select
              value={defaultSource}
              onChange={(e) => setDefaultSource(e.target.value)}
              className={inputClass}
              disabled={importing}
            >
              {FEEDBACK_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useTodayForDate}
              onChange={(e) => setUseTodayForDate(e.target.checked)}
              disabled={importing}
            />
            <span className="text-gray-400">Use today&apos;s date when not in CSV</span>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-2 pr-4">Our field</th>
                  <th className="pb-2">CSV column</th>
                </tr>
              </thead>
              <tbody>
                {FEEDBACK_FIELDS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="py-1 pr-4">{label}</td>
                    <td>
                      <select
                        value={mapping[key] ?? ""}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [key]: e.target.value || undefined,
                          }))
                        }
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100"
                        disabled={importing}
                      >
                        <option value="">— Skip —</option>
                        {columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Preview (first 5 rows)</p>
              <div className="overflow-x-auto max-h-40 overflow-y-auto rounded border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-left text-gray-400 sticky top-0">
                      {Object.keys(preview[0] || {}).map((k) => (
                        <th key={k} className="px-3 py-2">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-gray-200 truncate max-w-[200px]">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {importing && (
            <div className="space-y-2">
              <div className="h-2 bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${totalRows ? (processed / totalRows) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-400">Processing {processed} of {totalRows}…</p>
            </div>
          )}
          {result && (
            <div className="p-4 bg-gray-800 rounded-lg space-y-2">
              <p className="text-gray-100">
                Imported {result.imported_rows}, failed {result.failed_rows}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/feedback")}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  View Feedback
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500"
                >
                  Upload More
                </button>
              </div>
            </div>
          )}
          {!result && !importing && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmAndImport}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Upload CSV
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

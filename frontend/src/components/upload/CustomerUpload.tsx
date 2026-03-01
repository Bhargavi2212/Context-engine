import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { parseCustomers, importCustomers, getStatus } from "../../services/uploadApi";

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm text-gray-400 mb-1";

const CUSTOMER_FIELDS = [
  { key: "company_name", label: "Company name *", required: true },
  { key: "segment", label: "Segment", required: false },
  { key: "plan", label: "Plan", required: false },
  { key: "mrr", label: "MRR", required: false },
  { key: "arr", label: "ARR", required: false },
  { key: "account_manager", label: "Account manager", required: false },
  { key: "renewal_date", label: "Renewal date", required: false },
  { key: "health_score", label: "Health score", required: false },
  { key: "industry", label: "Industry", required: false },
  { key: "employee_count", label: "Employee count", required: false },
];

const POLL_INTERVAL_MS = 1500;

export default function CustomerUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<{
    imported_rows: number;
    segments?: Record<string, number>;
    total_arr?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollStatus = useCallback(async (id: string) => {
    const res = await getStatus(id);
    setProcessed(res.processed);
    setStatus(res.status);
    if (res.status === "completed" || res.status === "failed") {
      const imported = res.imported_rows ?? res.processed ?? 0;
      setResult({
        imported_rows: imported,
        segments: res.result_data?.segments,
        total_arr: res.result_data?.total_arr,
      });
      setImporting(false);
      if (res.status === "completed") toast.success(`Upload complete: ${imported} customers imported`);
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
      const parsed = await parseCustomers(f);
      setFile(f);
      setUploadId(parsed.upload_id);
      setColumns(parsed.columns);
      setMapping(parsed.suggested_mapping || {});
      setPreview(parsed.preview || []);
      setTotalRows(parsed.rows);
      if (!parsed.suggested_mapping?.company_name) {
        setMapping((m) => ({ ...m, company_name: parsed.columns[0] || "" }));
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
    if (!uploadId || !mapping.company_name) {
      setError("Company name column is required");
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      await importCustomers(uploadId, mapping);
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
      <h3 className="font-medium text-gray-100">Customer CSV Upload</h3>
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {!uploadId ? (
        <label
          htmlFor="customer-csv-input"
          className="block border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 cursor-pointer transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            id="customer-csv-input"
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
          {!mapping.company_name && (
            <p className="text-yellow-400 text-sm">Company name column is required. Map it below.</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-2 pr-4">Our field</th>
                  <th className="pb-2">CSV column</th>
                </tr>
              </thead>
              <tbody>
                {CUSTOMER_FIELDS.map(({ key, label }) => (
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
            <div className="p-4 bg-gray-800 rounded-lg space-y-3">
              <p className="text-gray-100">Imported {result.imported_rows} customers</p>
              {result.segments && Object.keys(result.segments).length > 0 && (
                <div className="text-sm text-gray-400">
                  Segments:{" "}
                  {Object.entries(result.segments)
                    .map(([seg, count]) => `${seg} (${count})`)
                    .join(", ")}
                </div>
              )}
              {typeof result.total_arr === "number" && (
                <p className="text-sm text-gray-400">Total ARR: ${result.total_arr.toLocaleString()}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/customers")}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  View Customers
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

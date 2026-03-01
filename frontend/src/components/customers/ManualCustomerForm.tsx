import { useState } from "react";
import { createCustomer } from "../../services/customerApi";
import { CUSTOMER_SEGMENTS } from "../../types/customer";

const inputClass =
  "w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm text-gray-400 mb-1";

export default function ManualCustomerForm({
  onSuccess,
  onCancel,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");
  const [plan, setPlan] = useState("");
  const [mrr, setMrr] = useState("");
  const [arr, setArr] = useState("");
  const [accountManager, setAccountManager] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [healthScore, setHealthScore] = useState(50);
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mrrNum = mrr ? parseFloat(mrr) : NaN;
  const arrNum = arr ? parseFloat(arr) : NaN;
  const computedArr = !isNaN(mrrNum) ? mrrNum * 12 : undefined;

  const handleMrrChange = (v: string) => {
    setMrr(v);
    if (!arr) setArr("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCustomer({
        company_name: companyName.trim(),
        segment: segment || undefined,
        plan: plan || undefined,
        mrr: mrr ? parseFloat(mrr) : undefined,
        arr: arr ? parseFloat(arr) : undefined,
        account_manager: accountManager.trim() || undefined,
        renewal_date: renewalDate || undefined,
        health_score: healthScore,
        industry: industry.trim() || undefined,
        employee_count: employeeCount ? parseInt(employeeCount, 10) : undefined,
      });
      setCompanyName("");
      setSegment("");
      setPlan("");
      setMrr("");
      setArr("");
      setAccountManager("");
      setRenewalDate("");
      setHealthScore(50);
      setIndustry("");
      setEmployeeCount("");
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-medium text-gray-100">Add customer manually</h3>
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      <div>
        <label className={labelClass}>Company name *</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className={inputClass}
          required
          disabled={submitting}
        />
      </div>
      <div>
        <label className={labelClass}>Segment</label>
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className={inputClass}
          disabled={submitting}
        >
          <option value="">—</option>
          {CUSTOMER_SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Plan</label>
        <input
          type="text"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className={inputClass}
          disabled={submitting}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>MRR</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={mrr}
            onChange={(e) => handleMrrChange(e.target.value)}
            className={inputClass}
            disabled={submitting}
          />
        </div>
        <div>
          <label className={labelClass}>
            ARR {computedArr != null && !arr && <span className="text-gray-500">(auto: {computedArr.toLocaleString()})</span>}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={arr}
            onChange={(e) => setArr(e.target.value)}
            placeholder={computedArr != null ? String(computedArr) : ""}
            className={inputClass}
            disabled={submitting}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Health score (0–100)</label>
        <input
          type="range"
          min="0"
          max="100"
          value={healthScore}
          onChange={(e) => setHealthScore(parseInt(e.target.value, 10))}
          className="w-full"
          disabled={submitting}
        />
        <span className="text-sm text-gray-400">{healthScore}</span>
      </div>
      <div>
        <label className={labelClass}>Account manager</label>
        <input
          type="text"
          value={accountManager}
          onChange={(e) => setAccountManager(e.target.value)}
          className={inputClass}
          disabled={submitting}
        />
      </div>
      <div>
        <label className={labelClass}>Renewal date</label>
        <input
          type="date"
          value={renewalDate}
          onChange={(e) => setRenewalDate(e.target.value)}
          className={inputClass}
          disabled={submitting}
        />
      </div>
      <div>
        <label className={labelClass}>Industry</label>
        <input
          type="text"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className={inputClass}
          disabled={submitting}
        />
      </div>
      <div>
        <label className={labelClass}>Employee count</label>
        <input
          type="number"
          min="0"
          value={employeeCount}
          onChange={(e) => setEmployeeCount(e.target.value)}
          className={inputClass}
          disabled={submitting}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={submitting || !companyName.trim()}
        >
          {submitting ? "Adding…" : "Add customer"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

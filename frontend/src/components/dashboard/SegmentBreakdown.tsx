import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SegmentBreakdown as SegmentBreakdownType } from "../../services/dashboardApi";

interface SegmentBreakdownProps {
  data: SegmentBreakdownType | null;
  loading: boolean;
}

const SEGMENT_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"];

function formatArr(arr: number): string {
  if (arr >= 1_000_000) return `$${(arr / 1_000_000).toFixed(1)}M`;
  if (arr >= 1_000) return `$${(arr / 1_000).toFixed(0)}K`;
  return `$${arr}`;
}

export function SegmentBreakdown({ data, loading }: SegmentBreakdownProps) {
  const navigate = useNavigate();

  if (loading || !data) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-64 animate-pulse" />
    );
  }

  const segments = Object.entries(data).map(([segment, v]) => ({
    segment,
    count: v.count,
    sentiment: v.sentiment,
    arr: v.arr,
  }));

  if (segments.length === 0) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4">
        <h3 className="text-sm font-medium text-gray-300">Segment Breakdown</h3>
        <p className="text-gray-500 text-sm py-8">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 relative">
      <h3 className="text-sm font-medium text-gray-300">Feedback by Segment</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-2">Shows customer count per segment (e.g. Enterprise, SMB). Each bar = one segment. ARR shown below.</p>
      <div className="rounded border border-gray-600 bg-gray-900/80 px-2 py-1.5 text-xs mb-2">
        <p className="font-medium text-gray-300 mb-1">Bar color = Segment:</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {segments.map((d, i) => (
            <span key={d.segment} className="flex items-center gap-1.5 text-gray-200">
              <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
              {d.segment}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={segments} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis dataKey="segment" stroke="#6b7280" tick={{ fontSize: 11 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563" }}
            formatter={(value: number) => [value, "Customers"]}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            minPointSize={8}
            onClick={(entry) => {
              if (entry?.segment) navigate(`/feedback?segment=${encodeURIComponent(entry.segment)}`);
            }}
            cursor="pointer"
          >
            {segments.map((_, i) => (
              <Cell key={segments[i].segment} fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 pt-3 border-t border-gray-700 flex flex-wrap gap-4 text-sm text-gray-400">
        {segments.map((s) => (
          <span key={s.segment}>
            <button
              type="button"
              onClick={() => navigate(`/feedback?segment=${encodeURIComponent(s.segment)}`)}
              className="hover:text-gray-200 font-medium"
            >
              {s.segment}
            </button>
            : {formatArr(s.arr)} ARR
          </span>
        ))}
      </div>
    </div>
  );
}

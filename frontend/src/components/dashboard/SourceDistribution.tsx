import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { SourceDistribution as SourceDistributionType } from "../../services/dashboardApi";

interface SourceDistributionProps {
  data: SourceDistributionType | null;
  loading: boolean;
}

const PIE_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#8b5cf6", "#ec4899", "#6b7280"];

export function SourceDistribution({ data, loading }: SourceDistributionProps) {
  const navigate = useNavigate();

  if (loading || !data) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-64 animate-pulse" />
    );
  }

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const segments = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([source, count]) => ({ name: source, value: count, source }));

  if (total === 0 || segments.length === 0) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4">
        <h3 className="text-sm font-medium text-gray-300">Source Distribution</h3>
        <p className="text-gray-500 text-sm py-8">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 relative">
      <h3 className="text-sm font-medium text-gray-300">Source Distribution</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-2">Shows where feedback comes from: support, NPS, app store, etc. Each slice = one channel. Click to filter.</p>
      <div className="rounded border border-gray-600 bg-gray-900/80 px-2 py-1.5 text-xs mb-2 max-h-24 overflow-y-auto">
        <p className="font-medium text-gray-300 mb-1">Color = Source:</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {segments.map((d) => (
            <span key={d.source} className="flex items-center gap-1.5 text-gray-200">
              <span
                className="w-2.5 h-2.5 rounded shrink-0"
                style={{ backgroundColor: PIE_COLORS[segments.indexOf(d) % PIE_COLORS.length] }}
              />
              {d.name}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={segments}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            onClick={(entry) => {
              const src = (entry as { source?: string })?.source;
              if (src) navigate(`/feedback?source=${encodeURIComponent(src)}`);
            }}
            cursor="pointer"
          >
            {segments.map((_, i) => (
              <Cell key={segments[i].name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563" }}
            formatter={(value: number) => {
              const pct = total ? ((value / total) * 100).toFixed(1) : "0";
              return [`${value} (${pct}%)`, "Count"];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

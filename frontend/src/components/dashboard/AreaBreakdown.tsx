import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { AreaBreakdown as AreaBreakdownType } from "../../services/dashboardApi";

interface AreaBreakdownProps {
  data: AreaBreakdownType | null;
  loading: boolean;
}

/** Sentiment -1..1 -> red (neg) to green (pos) */
function sentimentToColor(sentiment: number): string {
  if (sentiment <= -0.5) return "#ef4444";
  if (sentiment <= 0) return "#f97316";
  if (sentiment < 0.5) return "#eab308";
  return "#22c55e";
}

export function AreaBreakdown({ data, loading }: AreaBreakdownProps) {
  const navigate = useNavigate();

  if (loading || !data) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-64 animate-pulse" />
    );
  }

  const chartData = Object.entries(data).map(([area, v]) => ({
    area,
    count: v.count,
    sentiment: v.sentiment,
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4">
        <h3 className="text-sm font-medium text-gray-300">Product Area Breakdown</h3>
        <p className="text-gray-500 text-sm py-8">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 relative">
      <h3 className="text-sm font-medium text-gray-300">Product Area Breakdown</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-2">Shows how many feedback items each product area received. Bar color = average sentiment for that area.</p>
      <div className="rounded border border-gray-600 bg-gray-900/80 px-2 py-1.5 text-xs mb-2 inline-block">
        <p className="font-medium text-gray-300 mb-1">Bar colors:</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="flex items-center gap-1.5 text-gray-200"><span className="w-2.5 h-2.5 rounded bg-green-500 shrink-0" /> Green = Positive</span>
          <span className="flex items-center gap-1.5 text-gray-200"><span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0" /> Amber = Neutral</span>
          <span className="flex items-center gap-1.5 text-gray-200"><span className="w-2.5 h-2.5 rounded bg-red-500 shrink-0" /> Red = Negative</span>
        </div>
      </div>
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="area" stroke="#6b7280" tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563" }}
            formatter={(value: number, _name: string, props: { payload: { sentiment: number } }) => [
              `${value} (avg sentiment: ${props.payload.sentiment.toFixed(2)})`,
              "Count",
            ]}
            labelFormatter={(label) => `Area: ${label}`}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            onClick={(entry) => {
              if (entry?.area) navigate(`/feedback?area=${encodeURIComponent(entry.area)}`);
            }}
            cursor="pointer"
          >
            {chartData.map((row, i) => (
              <Cell key={row.area} fill={sentimentToColor(row.sentiment)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

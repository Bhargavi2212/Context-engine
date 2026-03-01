import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { SentimentBreakdown } from "../../services/dashboardApi";

interface SentimentDonutProps {
  data: SentimentBreakdown | null;
  loading: boolean;
}

const COLORS = { positive: "#22c55e", negative: "#ef4444", neutral: "#6b7280" };

export function SentimentDonut({ data, loading }: SentimentDonutProps) {
  const navigate = useNavigate();

  if (loading || !data) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-64 animate-pulse" />
    );
  }

  const total = data.positive + data.negative + data.neutral;
  const segments = [
    { name: "Positive", value: data.positive, sentiment: "positive" },
    { name: "Negative", value: data.negative, sentiment: "negative" },
    { name: "Neutral", value: data.neutral, sentiment: "neutral" },
  ].filter((s) => s.value > 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4">
        <h3 className="text-sm font-medium text-gray-300">Sentiment Breakdown</h3>
        <p className="text-gray-500 text-sm py-8">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 relative">
      <h3 className="text-sm font-medium text-gray-300">Sentiment Breakdown</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-2">Shows what % of feedback is positive, negative, or neutral. Click a slice to view those items.</p>
      <div className="rounded border border-gray-600 bg-gray-900/80 px-2 py-1.5 text-xs mb-2 inline-block">
        <p className="font-medium text-gray-300 mb-1">Slice colors:</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="flex items-center gap-1.5 text-gray-200"><span className="w-2.5 h-2.5 rounded bg-green-500 shrink-0" /> Green = Positive</span>
          <span className="flex items-center gap-1.5 text-gray-200"><span className="w-2.5 h-2.5 rounded bg-red-500 shrink-0" /> Red = Negative</span>
          <span className="flex items-center gap-1.5 text-gray-200"><span className="w-2.5 h-2.5 rounded bg-gray-500 shrink-0" /> Gray = Neutral</span>
        </div>
      </div>
      <div className="relative h-64 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              onClick={(entry) => {
                const s = entry?.sentiment as string;
                if (s) navigate(`/feedback?sentiment=${s}`);
              }}
              cursor="pointer"
            >
              {segments.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.sentiment === "positive"
                      ? COLORS.positive
                      : entry.sentiment === "negative"
                        ? COLORS.negative
                        : COLORS.neutral
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563" }}
              formatter={(value: number, name: string, props: { payload: { value: number; sentiment: string } }) => {
                const pct = total ? ((value / total) * 100).toFixed(1) : "0";
                return [`${value} (${pct}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-2xl font-semibold text-gray-200">{total}</span>
        </div>
      </div>
    </div>
  );
}

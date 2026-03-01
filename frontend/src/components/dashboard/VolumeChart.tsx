import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { VolumeOverTimeItem } from "../../services/dashboardApi";

interface VolumeChartProps {
  data: VolumeOverTimeItem[];
  loading: boolean;
}

export function VolumeChart({ data, loading }: VolumeChartProps) {
  const navigate = useNavigate();

  const handleClick = (e: { activePayload?: { payload: { date: string } }[] }) => {
    const payload = e?.activePayload?.[0]?.payload;
    if (payload?.date) {
      navigate(`/feedback?date_from=${payload.date}&date_to=${payload.date}`);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 h-64 animate-pulse" />
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    count: d.count,
    sentiment: d.sentiment,
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4">
        <h3 className="text-sm font-medium text-gray-300">Feedback Volume Over Time</h3>
        <p className="text-gray-500 text-sm py-8">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-4 relative">
      <h3 className="text-sm font-medium text-gray-300">Feedback Volume Over Time</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-2">Shows how many feedback items you received each day. Blue = volume; red = average sentiment. Click a point to filter feedback by that date.</p>
      <div className="rounded border border-gray-600 bg-gray-900/80 px-2 py-1.5 text-xs mb-2 inline-block">
        <span className="flex items-center gap-1.5 text-gray-200"><span className="w-4 h-0.5 rounded bg-blue-500 shrink-0" /> Blue = volume</span>
        <span className="flex items-center gap-1.5 text-gray-200 ml-3"><span className="w-4 h-0.5 rounded bg-red-500 shrink-0" /> Red = sentiment</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} onClick={handleClick} margin={{ top: 5, right: 20, left: 0, bottom: 0 }} cursor="pointer">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            domain={[-1, 1]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563" }}
            labelStyle={{ color: "#d1d5db" }}
            formatter={(value: number, name: string) => [
              name === "sentiment" ? value.toFixed(2) : value,
              name === "sentiment" ? "Sentiment" : "Count",
            ]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="count"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="sentiment"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={{ r: 2 }}
            name="sentiment"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

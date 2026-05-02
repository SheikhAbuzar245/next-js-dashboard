"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DurationBarChartProps {
  data: { day: string; avgDuration: number }[];
}

export default function DurationBarChart({ data }: DurationBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}s`} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "13px",
          }}
          formatter={(value: number) => [`${value}s`, "Avg Duration"]}
        />
        <Bar
          dataKey="avgDuration"
          fill="#8b5cf6"
          radius={[4, 4, 0, 0]}
          name="Avg Duration"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

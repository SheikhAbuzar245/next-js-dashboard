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

interface CallsBarChartProps {
  data: { day: string; calls: number; bookings: number }[];
}

export default function CallsBarChart({ data }: CallsBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "13px",
          }}
        />
        <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Calls" />
        <Bar dataKey="bookings" fill="#10b981" radius={[4, 4, 0, 0]} name="Bookings" />
      </BarChart>
    </ResponsiveContainer>
  );
}

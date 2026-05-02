"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BookingsTrendChartProps {
  data: { date: string; bookings: number }[];
}

export default function BookingsTrendChart({ data }: BookingsTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "13px",
          }}
        />
        <Line
          type="monotone"
          dataKey="bookings"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Bookings"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

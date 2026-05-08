"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CostBreakdownChartProps {
  data: { day: string; stt: number; llm: number; tts: number; vapi: number }[];
}

const fmt = (v: number) => `$${v.toFixed(4)}`;

export default function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
        <Tooltip
          formatter={(value: number, name: string) => [fmt(value), name.toUpperCase()]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
        />
        <Legend />
        <Bar dataKey="vapi" stackId="a" fill="#6366f1" name="Vapi" radius={[0, 0, 0, 0]} />
        <Bar dataKey="llm"  stackId="a" fill="#3b82f6" name="LLM" />
        <Bar dataKey="tts"  stackId="a" fill="#10b981" name="TTS" />
        <Bar dataKey="stt"  stackId="a" fill="#f59e0b" name="STT" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

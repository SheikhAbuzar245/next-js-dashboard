"use client";

interface LeadsFunnelChartProps {
  data: { stage: string; value: number }[];
}

export default function LeadsFunnelChart({ data }: LeadsFunnelChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

  return (
    <div className="space-y-3 py-2">
      {data.map((item, i) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <div key={item.stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{item.stage}</span>
              <span className="text-sm font-bold text-gray-900">{item.value}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-7 flex items-center px-1">
              <div
                className="h-5 rounded-full transition-all flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max(pct, 5)}%`,
                  backgroundColor: colors[i % colors.length],
                }}
              >
                {pct > 15 && (
                  <span className="text-white text-xs font-semibold">{pct}%</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

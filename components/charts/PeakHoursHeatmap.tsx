"use client";

interface HeatmapData {
  days: string[];
  hours: number[];
  grid: Record<string, Record<number, number>>;
}

interface PeakHoursHeatmapProps {
  data: HeatmapData;
}

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "#f3f4f6";
  const intensity = value / max;
  if (intensity > 0.75) return "#1d4ed8";
  if (intensity > 0.5) return "#3b82f6";
  if (intensity > 0.25) return "#93c5fd";
  return "#dbeafe";
}

export default function PeakHoursHeatmap({ data }: PeakHoursHeatmapProps) {
  const { days, hours, grid } = data;
  const peakHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  const allValues = days.flatMap((d) => peakHours.map((h) => grid[d]?.[h] ?? 0));
  const max = Math.max(...allValues, 1);

  const formatHour = (h: number) => {
    if (h === 0) return "12am";
    if (h < 12) return `${h}am`;
    if (h === 12) return "12pm";
    return `${h - 12}pm`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="flex items-center gap-1 mb-2 pl-12">
          {peakHours.map((h) => (
            <div key={h} className="w-9 text-center text-xs text-gray-400">
              {formatHour(h)}
            </div>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <div className="w-10 text-xs text-gray-500 font-medium text-right pr-2">{day}</div>
            {peakHours.map((h) => {
              const value = grid[day]?.[h] ?? 0;
              return (
                <div
                  key={h}
                  className="w-9 h-7 rounded flex items-center justify-center text-xs font-medium transition-colors"
                  style={{ backgroundColor: getColor(value, max) }}
                  title={`${day} ${formatHour(h)}: ${value} calls`}
                >
                  {value > 0 && (
                    <span className={value / max > 0.4 ? "text-white" : "text-blue-700"}>
                      {value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3 pl-12">
          <span className="text-xs text-gray-400">Low</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <div
              key={v}
              className="w-6 h-4 rounded"
              style={{ backgroundColor: getColor(v * max, max) }}
            />
          ))}
          <span className="text-xs text-gray-400">High</span>
        </div>
      </div>
    </div>
  );
}

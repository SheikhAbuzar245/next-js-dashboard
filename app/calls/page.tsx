import { createServiceClient } from "@/lib/supabase";
import { formatCallDuration, getStatusColor } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DurationBarChart from "@/components/charts/DurationBarChart";
import CallsTableClient from "@/components/tables/CallsTableClient";
import type { Call } from "@/types";
import { subDays } from "date-fns";
import AutoRefresh from "@/components/shared/AutoRefresh";

async function getCalls(): Promise<{ calls: Call[]; chartData: { day: string; avgDuration: number }[] }> {
  const db = createServiceClient();
  const { data: calls } = await db
    .from("calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  // Duration chart — last 7 days
  const { data: weekCalls } = await db
    .from("calls")
    .select("created_at, duration")
    .gte("created_at", subDays(new Date(), 6).toISOString())
    .eq("status", "completed");

  const dayMap: Record<string, number[]> = {};
  weekCalls?.forEach((c) => {
    const d = format(new Date(c.created_at), "EEE");
    if (!dayMap[d]) dayMap[d] = [];
    if (c.duration) dayMap[d].push(c.duration);
  });

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const day = format(d, "EEE");
    const durations = dayMap[day] ?? [];
    const avg = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    return { day, avgDuration: avg };
  });

  return { calls: calls ?? [], chartData };
}

export default async function CallsPage() {
  const { calls, chartData } = await getCalls();

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30000} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Logs</h1>
        <p className="text-gray-500 text-sm mt-1">
          All calls handled by the AI agent
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Average Call Duration (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <DurationBarChart data={chartData} />
        </CardContent>
      </Card>

      <CallsTableClient calls={calls} />
    </div>
  );
}

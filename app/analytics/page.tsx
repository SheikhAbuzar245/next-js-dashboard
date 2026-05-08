import { createServiceClient } from "@/lib/supabase";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/cards/StatCard";
import CallsBarChart from "@/components/charts/CallsBarChart";
import CallStatusDonut from "@/components/charts/CallStatusDonut";
import BookingsTrendChart from "@/components/charts/BookingsTrendChart";
import TopClassesPieChart from "@/components/charts/TopClassesPieChart";
import PeakHoursHeatmap from "@/components/charts/PeakHoursHeatmap";
import CostBreakdownChart from "@/components/charts/CostBreakdownChart";
import { TrendingUp, Phone, Calendar, Users, DollarSign } from "lucide-react";
import { formatCallDuration } from "@/lib/utils";

async function getAnalyticsData() {
  const db = createServiceClient();
  const sevenDaysAgo = subDays(new Date(), 6);
  const thirtyDaysAgo = subDays(new Date(), 29);

  const [
    { data: weekCalls },
    { data: weekAnalytics },
    { data: bookings30 },
    { data: allBookings },
    { data: allMembers },
    { data: allCostCalls },
  ] = await Promise.all([
    db.from("calls").select("*").gte("created_at", sevenDaysAgo.toISOString()),
    db.from("analytics").select("*").gte("date", format(sevenDaysAgo, "yyyy-MM-dd")).order("date"),
    db.from("bookings").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()),
    db.from("bookings").select("class_name"),
    db.from("members").select("status"),
    db.from("calls").select("cost, cost_breakdown, created_at, duration").not("cost", "is", null),
  ]);

  const totalCalls = weekCalls?.length ?? 0;
  const completed = weekCalls?.filter((c) => c.status === "completed").length ?? 0;
  const missed = weekCalls?.filter((c) => c.status === "missed").length ?? 0;
  const failed = weekCalls?.filter((c) => c.status === "failed").length ?? 0;
  const durations = weekCalls?.filter((c) => c.duration).map((c) => c.duration as number) ?? [];
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  const resolutionRate = totalCalls > 0 ? `${Math.round((completed / totalCalls) * 100)}%` : "—";
  const bookedCount = weekCalls?.filter((c) => c.booking_made).length ?? 0;
  const bookingSuccessRate = totalCalls > 0 ? `${Math.round((bookedCount / totalCalls) * 100)}%` : "—";

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const date = format(d, "yyyy-MM-dd");
    const row = weekAnalytics?.find((r) => r.date === date);
    return { day: format(d, "EEE"), calls: row?.total_calls ?? 0, bookings: row?.bookings_made ?? 0 };
  });

  // 30-day bookings trend
  const dayMap: Record<string, number> = {};
  bookings30?.forEach((b) => {
    const d = format(new Date(b.created_at), "MMM d");
    dayMap[d] = (dayMap[d] ?? 0) + 1;
  });
  const trendData = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    const label = format(d, "MMM d");
    return { date: i % 5 === 0 ? label : "", bookings: dayMap[label] ?? 0 };
  });

  // Top classes
  const classCount: Record<string, number> = {};
  allBookings?.forEach((b) => {
    classCount[b.class_name] = (classCount[b.class_name] ?? 0) + 1;
  });
  const topClasses = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Peak hours heatmap from calls
  const heatmap = buildHeatmap(weekCalls ?? []);

  // Cost analytics
  type CostCall = { cost: number; cost_breakdown: Record<string, number> | null; created_at: string; duration: number | null };
  const costCalls = (allCostCalls ?? []) as CostCall[];
  const totalCost = costCalls.reduce((sum, c) => sum + (c.cost ?? 0), 0);
  const avgCostPerCall = costCalls.length > 0 ? totalCost / costCalls.length : 0;
  const totalDurationSec = costCalls.reduce((sum, c) => sum + (c.duration ?? 0), 0);
  const costPerMinute = totalDurationSec > 0 ? (totalCost / (totalDurationSec / 60)) : 0;
  const weekCostCalls = costCalls.filter((c) => new Date(c.created_at) >= sevenDaysAgo);
  const costThisWeek = weekCostCalls.reduce((sum, c) => sum + (c.cost ?? 0), 0);

  // Daily cost breakdown for chart (last 7 days)
  const costChartData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayStr = format(d, "yyyy-MM-dd");
    const dayCalls = costCalls.filter((c) => c.created_at.startsWith(dayStr));
    return {
      day: format(d, "EEE"),
      stt:  dayCalls.reduce((s, c) => s + (c.cost_breakdown?.stt ?? 0), 0),
      llm:  dayCalls.reduce((s, c) => s + (c.cost_breakdown?.llm ?? 0), 0),
      tts:  dayCalls.reduce((s, c) => s + (c.cost_breakdown?.tts ?? 0), 0),
      vapi: dayCalls.reduce((s, c) => s + (c.cost_breakdown?.vapi ?? 0), 0),
    };
  });

  return {
    totalCalls,
    completed,
    missed,
    failed,
    resolutionRate,
    avgDuration,
    bookingSuccessRate,
    chartData,
    trendData,
    topClasses,
    heatmap,
    newLeads: allMembers?.filter((m) => m.status === "lead").length ?? 0,
    activeMembers: allMembers?.filter((m) => m.status === "active").length ?? 0,
    totalCost,
    avgCostPerCall,
    costPerMinute,
    costThisWeek,
    costChartData,
  };
}

function buildHeatmap(calls: { started_at: string | null }[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const grid: Record<string, Record<number, number>> = {};

  days.forEach((d) => {
    grid[d] = {};
    hours.forEach((h) => (grid[d][h] = 0));
  });

  calls.forEach((c) => {
    if (!c.started_at) return;
    const date = new Date(c.started_at);
    const dayIndex = (date.getDay() + 6) % 7;
    const hour = date.getHours();
    grid[days[dayIndex]][hour] += 1;
  });

  return { days, hours, grid };
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Performance overview (last 7–30 days)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Calls (7d)" value={data.totalCalls} icon={Phone} iconColor="text-blue-600" />
        <StatCard title="Resolution Rate" value={data.resolutionRate} icon={TrendingUp} iconColor="text-green-600" />
        <StatCard title="Booking Rate" value={data.bookingSuccessRate} icon={Calendar} iconColor="text-orange-600" />
        <StatCard title="Avg Call Duration" value={formatCallDuration(data.avgDuration)} icon={Users} iconColor="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Calls & Bookings This Week</CardTitle></CardHeader>
          <CardContent><CallsBarChart data={data.chartData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Call Status</CardTitle></CardHeader>
          <CardContent>
            <CallStatusDonut completed={data.completed} missed={data.missed} failed={data.failed} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card>
          <CardHeader><CardTitle>Bookings Trend (30 Days)</CardTitle></CardHeader>
          <CardContent><BookingsTrendChart data={data.trendData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Most Booked Classes</CardTitle></CardHeader>
          <CardContent><TopClassesPieChart data={data.topClasses} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Peak Call Hours Heatmap</CardTitle></CardHeader>
        <CardContent>
          <PeakHoursHeatmap data={data.heatmap} />
        </CardContent>
      </Card>

      {/* ── Cost & Billing ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost & Billing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            title="Total Spend (All Time)"
            value={`$${data.totalCost.toFixed(4)}`}
            icon={DollarSign}
            iconColor="text-green-600"
          />
          <StatCard
            title="This Week"
            value={`$${data.costThisWeek.toFixed(4)}`}
            icon={DollarSign}
            iconColor="text-blue-600"
          />
          <StatCard
            title="Avg Cost / Call"
            value={`$${data.avgCostPerCall.toFixed(4)}`}
            icon={DollarSign}
            iconColor="text-purple-600"
          />
          <StatCard
            title="Avg Cost / Min"
            value={`$${data.costPerMinute.toFixed(4)}`}
            icon={DollarSign}
            iconColor="text-orange-600"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily Cost Breakdown (Last 7 Days)</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Stacked by provider — STT (Deepgram) · LLM (OpenAI) · TTS (ElevenLabs) · Vapi platform</p>
          </CardHeader>
          <CardContent>
            <CostBreakdownChart data={data.costChartData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

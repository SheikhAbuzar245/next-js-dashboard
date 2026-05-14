export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/cards/StatCard";
import AutoRefresh from "@/components/shared/AutoRefresh";
import CallsBarChart from "@/components/charts/CallsBarChart";
import CallStatusDonut from "@/components/charts/CallStatusDonut";
import BookingsTrendChart from "@/components/charts/BookingsTrendChart";
import TopClassesPieChart from "@/components/charts/TopClassesPieChart";
import PeakHoursHeatmap from "@/components/charts/PeakHoursHeatmap";
import { TrendingUp, Phone, Calendar, Users } from "lucide-react";
import { formatCallDuration, BUSINESS_TZ } from "@/lib/utils";

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
  ] = await Promise.all([
    db.from("calls").select("*").gte("created_at", sevenDaysAgo.toISOString()),
    db.from("analytics").select("*").gte("date", format(sevenDaysAgo, "yyyy-MM-dd")).order("date"),
    db.from("bookings").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()),
    db.from("bookings").select("class_name"),
    db.from("members").select("status"),
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
  };
}

function buildHeatmap(calls: { created_at: string | null }[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const grid: Record<string, Record<number, number>> = {};

  days.forEach((d) => {
    grid[d] = {};
    hours.forEach((h) => (grid[d][h] = 0));
  });

  // Format every timestamp into the business timezone, then bucket by weekday + hour.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const dayLabelMap: Record<string, string> = {
    Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun",
  };

  calls.forEach((c) => {
    if (!c.created_at) return;
    const parts = fmt.formatToParts(new Date(c.created_at));
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    // Intl returns "24" for midnight in some locales; normalize to 0.
    const hour = Number(hourStr) % 24;
    const dayKey = dayLabelMap[weekday] ?? "Mon";
    grid[dayKey][hour] += 1;
  });

  return { days, hours, grid };
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30000} />
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

    </div>
  );
}

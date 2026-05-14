import { Phone, Calendar, Users, TrendingUp } from "lucide-react";
import { createServiceClient } from "@/lib/supabase";
import StatCard from "@/components/cards/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CallsBarChart from "@/components/charts/CallsBarChart";
import CallStatusDonut from "@/components/charts/CallStatusDonut";
import LiveCallBanner from "@/components/layout/LiveCallBanner";
import CallAgentButton from "@/components/shared/CallAgentButton";
import RecentCallsCard from "@/components/cards/RecentCallsCard";
import AutoRefresh from "@/components/shared/AutoRefresh";
import { format, subDays } from "date-fns";
import type { Call } from "@/types";
import { getBusinessDateStr, getBusinessDayStartUTC } from "@/lib/utils";

async function getOverviewData() {
  const db = createServiceClient();
  const today = getBusinessDateStr();
  const todayStart = getBusinessDayStartUTC(today);

  const [
    { data: todayCalls },
    { data: todayBookings },
    { data: todayLeads },
    { data: activeCalls },
    { data: recentCalls },
  ] = await Promise.all([
    db.from("calls").select("status").gte("created_at", todayStart),
    db.from("bookings").select("id").gte("created_at", todayStart),
    db.from("members").select("id").gte("created_at", todayStart),
    db.from("calls").select("id").eq("status", "active"),
    db.from("calls").select("*").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalCalls = todayCalls?.length ?? 0;
  const completed = todayCalls?.filter((c) => c.status === "completed").length ?? 0;
  const missed = todayCalls?.filter((c) => c.status === "missed").length ?? 0;
  const failed = todayCalls?.filter((c) => c.status === "failed").length ?? 0;
  const resolutionRate = totalCalls > 0 ? Math.round((completed / totalCalls) * 100) : 0;

  // Last 7 days for chart
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return format(d, "EEE");
  });

  const { data: weekAnalytics } = await db
    .from("analytics")
    .select("date, total_calls, bookings_made")
    .gte("date", format(subDays(new Date(), 6), "yyyy-MM-dd"))
    .order("date");

  const chartData = days.map((day, i) => {
    const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const row = weekAnalytics?.find((r) => r.date === date);
    return { day, calls: row?.total_calls ?? 0, bookings: row?.bookings_made ?? 0 };
  });

  return {
    totalCalls,
    bookingsToday: todayBookings?.length ?? 0,
    newLeads: todayLeads?.length ?? 0,
    resolutionRate,
    completed,
    missed,
    failed,
    chartData,
    hasActiveCall: (activeCalls?.length ?? 0) > 0,
    recentCalls: (recentCalls ?? []) as Call[],
  };
}

export default async function OverviewPage() {
  const data = await getOverviewData();

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30000} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">
          Real-time gym AI performance
        </p>
      </div>

      {data.hasActiveCall && <LiveCallBanner />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Calls Today"
          value={data.totalCalls}
          icon={Phone}
          iconColor="text-blue-600"
        />
        <StatCard
          title="Bookings Today"
          value={data.bookingsToday}
          icon={Calendar}
          iconColor="text-green-600"
        />
        <StatCard
          title="New Leads Today"
          value={data.newLeads}
          icon={Users}
          iconColor="text-purple-600"
        />
        <StatCard
          title="Resolution Rate"
          value={`${data.resolutionRate}%`}
          subtitle="Calls handled by AI"
          icon={TrendingUp}
          iconColor="text-orange-600"
        />
      </div>

      <CallAgentButton />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Calls & Bookings This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <CallsBarChart data={data.chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <CallStatusDonut
              completed={data.completed}
              missed={data.missed}
              failed={data.failed}
            />
          </CardContent>
        </Card>
      </div>

      <RecentCallsCard calls={data.recentCalls} />
    </div>
  );
}

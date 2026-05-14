export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BookingsTrendChart from "@/components/charts/BookingsTrendChart";
import TopClassesPieChart from "@/components/charts/TopClassesPieChart";
import BookingsTableClient from "@/components/tables/BookingsTableClient";
import type { Booking } from "@/types";
import AutoRefresh from "@/components/shared/AutoRefresh";

async function getBookingsData() {
  const db = createServiceClient();

  const { data: bookings } = await db
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  // 30-day trend
  const thirtyDaysAgo = subDays(new Date(), 29);
  const { data: trendData } = await db
    .from("bookings")
    .select("created_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const dayMap: Record<string, number> = {};
  trendData?.forEach((b) => {
    const d = format(new Date(b.created_at), "MMM d");
    dayMap[d] = (dayMap[d] ?? 0) + 1;
  });

  const trendChartData = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    const label = format(d, "MMM d");
    return { date: i % 5 === 0 ? label : "", bookings: dayMap[label] ?? 0 };
  });

  // Top classes
  const classCount: Record<string, number> = {};
  bookings?.forEach((b) => {
    classCount[b.class_name] = (classCount[b.class_name] ?? 0) + 1;
  });
  const topClasses = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  return { bookings: bookings ?? [], trendChartData, topClasses };
}

export default async function BookingsPage() {
  const { bookings, trendChartData, topClasses } = await getBookingsData();

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30000} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-500 text-sm mt-1">
          All class bookings made by the AI agent
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bookings Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingsTrendChart data={trendChartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most Booked Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <TopClassesPieChart data={topClasses} />
          </CardContent>
        </Card>
      </div>

      <BookingsTableClient bookings={bookings} />
    </div>
  );
}

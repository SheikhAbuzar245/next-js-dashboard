import { createServiceClient } from "@/lib/supabase";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BookingsTrendChart from "@/components/charts/BookingsTrendChart";
import TopClassesPieChart from "@/components/charts/TopClassesPieChart";
import type { Booking } from "@/types";

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

const statusVariant = (status: string) => {
  if (status === "confirmed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  return "warning" as const;
};

export default async function BookingsPage() {
  const { bookings, trendChartData, topClasses } = await getBookingsData();

  return (
    <div className="space-y-6">
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="font-semibold text-gray-900 text-sm">
            {bookings.length} bookings total
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Booked At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No bookings yet
                  </td>
                </tr>
              )}
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{booking.member_name}</td>
                  <td className="px-4 py-3 text-gray-600">{booking.member_phone}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{booking.class_name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {booking.class_time ? format(new Date(booking.class_time), "MMM d, h:mm a") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(booking.status)}>{booking.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {format(new Date(booking.created_at), "MMM d, h:mm a")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

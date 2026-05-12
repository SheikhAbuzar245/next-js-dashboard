import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { formatCallDuration } from "@/lib/utils";

export async function GET() {
  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Today's stats from calls table
  const { data: todayCalls } = await db
    .from("calls")
    .select("status, booking_made, lead_captured")
    .gte("created_at", `${today}T00:00:00`);

  const totalCalls = todayCalls?.length ?? 0;
  const completedCalls = todayCalls?.filter((c) => c.status === "completed").length ?? 0;
  const missedCalls = todayCalls?.filter((c) => c.status === "missed").length ?? 0;
  const bookingsMade = todayCalls?.filter((c) => c.booking_made).length ?? 0;
  const newLeads = todayCalls?.filter((c) => c.lead_captured).length ?? 0;

  // Last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const { data: weekAnalytics } = await db
    .from("analytics")
    .select("date, total_calls, bookings_made, avg_call_duration")
    .gte("date", sevenDaysAgoStr)
    .order("date");

  const callsPerDay: number[] = Array(7).fill(0);
  const bookingsPerDay: number[] = Array(7).fill(0);

  weekAnalytics?.forEach((row) => {
    const dayIndex = Math.floor(
      (new Date(row.date).getTime() - sevenDaysAgo.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (dayIndex >= 0 && dayIndex < 7) {
      callsPerDay[dayIndex] = row.total_calls;
      bookingsPerDay[dayIndex] = row.bookings_made;
    }
  });

  // Top class (last 7 days)
  const { data: bookings } = await db
    .from("bookings")
    .select("class_name")
    .gte("created_at", `${sevenDaysAgoStr}T00:00:00`);

  const classCount: Record<string, number> = {};
  bookings?.forEach((b) => {
    classCount[b.class_name] = (classCount[b.class_name] ?? 0) + 1;
  });
  const topClass =
    Object.entries(classCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // AI performance — single query with all needed fields
  const { data: allCalls } = await db
    .from("calls")
    .select("status, duration, booking_made")
    .gte("created_at", `${sevenDaysAgoStr}T00:00:00`);

  const total = allCalls?.length ?? 0;
  const resolved = allCalls?.filter((c) => c.status === "completed").length ?? 0;
  const resolutionRate = total > 0 ? `${Math.round((resolved / total) * 100)}%` : "—";

  const durations = allCalls?.filter((c) => c.duration).map((c) => c.duration as number) ?? [];
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const bookedCount = allCalls?.filter((c) => c.booking_made).length ?? 0;
  const bookingSuccessRate = total > 0 ? `${Math.round((bookedCount / total) * 100)}%` : "—";

  // Peak hour — computed from call created_at timestamps
  const hourCounts: number[] = Array(24).fill(0);
  allCalls?.forEach((c) => {
    // created_at is a string; extract UTC hour
    const raw = (c as { created_at?: string }).created_at;
    if (raw) {
      const hour = new Date(raw).getUTCHours();
      hourCounts[hour] += 1;
    }
  });
  const peakHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
  const peakHourLabel =
    total > 0
      ? `${peakHourIndex % 12 || 12}${peakHourIndex < 12 ? "am" : "pm"} – ${(peakHourIndex + 1) % 12 || 12}${(peakHourIndex + 1) < 12 ? "am" : "pm"}`
      : "—";

  return NextResponse.json({
    today: { totalCalls, completedCalls, missedCalls, bookingsMade, newLeads },
    thisWeek: {
      callsPerDay,
      bookingsPerDay,
      topClass,
      peakHour: peakHourLabel,
    },
    aiPerformance: {
      resolutionRate,
      avgCallDuration: formatCallDuration(avgDuration),
      bookingSuccessRate,
    },
  });
}

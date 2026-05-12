import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const date = searchParams.get("date");

  const db = createServiceClient();
  let query = db
    .from("bookings")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (date)
    query = query
      .gte("class_time", `${date}T00:00:00`)
      .lte("class_time", `${date}T23:59:59`);

  const { data: bookings, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bookings, total: count ?? 0 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { memberName, memberPhone, memberEmail, className, classTime, callId, notes } = body;

  const db = createServiceClient();
  const { data, error } = await db
    .from("bookings")
    .insert({
      call_id: callId ?? null,
      member_name: memberName,
      member_phone: memberPhone,
      member_email: memberEmail ?? null,
      class_name: className,
      class_time: classTime,
      notes: notes ?? null,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

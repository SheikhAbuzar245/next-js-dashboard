import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();
  const db = createServiceClient();

  const { data, error } = await db
    .from("calls")
    .insert({
      vapi_call_id: body.vapiCallId ?? null,
      caller_phone: body.callerPhone ?? "web-call",
      status: body.status ?? "completed",
      duration: body.duration ?? null,
      transcript: body.transcript ?? null,
      summary: body.summary ?? null,
      recording_url: body.recordingUrl ?? null,
      booking_made: body.bookingMade ?? false,
      lead_captured: body.leadCaptured ?? false,
      end_reason: body.endReason ?? null,
      started_at: body.startedAt ?? null,
      ended_at: body.endedAt ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update daily analytics snapshot
  const today = new Date().toISOString().split("T")[0];
  const { data: row } = await db.from("analytics").select("*").eq("date", today).single();
  if (row) {
    await db.from("analytics").update({
      total_calls: row.total_calls + 1,
      completed_calls: row.completed_calls + (body.status === "completed" ? 1 : 0),
      missed_calls: row.missed_calls + (body.status === "missed" ? 1 : 0),
    }).eq("date", today);
  } else {
    await db.from("analytics").insert({
      date: today,
      total_calls: 1,
      completed_calls: body.status === "completed" ? 1 : 0,
      missed_calls: body.status === "missed" ? 1 : 0,
    });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const page = parseInt(searchParams.get("page") ?? "1");
  const status = searchParams.get("status");
  const date = searchParams.get("date");

  const db = createServiceClient();
  let query = db
    .from("calls")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq("status", status);
  if (date) query = query.gte("created_at", `${date}T00:00:00`).lte("created_at", `${date}T23:59:59`);

  const { data: calls, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ calls, total: count ?? 0, page });
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getBusinessDateStr, getBusinessDayStartUTC, getBusinessDayEndUTC } from "@/lib/utils";

export async function POST(request: Request) {
  const body = await request.json();
  const db = createServiceClient();

  // Dedup: web calls are already saved by the webhook — just patch messages onto the existing record
  if (body.vapiCallId) {
    const { data: existing } = await db.from("calls").select("id").eq("vapi_call_id", body.vapiCallId).single();
    if (existing) {
      const { data: updated, error: updateError } = await db
        .from("calls")
        .update({ messages: body.messages ?? null })
        .eq("vapi_call_id", body.vapiCallId)
        .select()
        .single();
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json(updated, { status: 200 });
    }
  }

  const { data, error } = await db
    .from("calls")
    .insert({
      vapi_call_id: body.vapiCallId ?? null,
      caller_phone: body.callerPhone ?? "web-call",
      status: body.status ?? "completed",
      duration: body.duration ?? null,
      transcript: body.transcript ?? null,
      messages: body.messages ?? null,
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

  // Atomic daily analytics increment (race-free).
  await db.rpc("increment_analytics", {
    p_date: getBusinessDateStr(),
    p_total_calls: 1,
    p_completed_calls: body.status === "completed" ? 1 : 0,
    p_missed_calls: body.status === "missed" ? 1 : 0,
  });

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rawLimit = Number(searchParams.get("limit") ?? "20");
  const rawPage = Number(searchParams.get("page") ?? "1");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 20;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const status = searchParams.get("status");
  const date = searchParams.get("date");

  const db = createServiceClient();
  let query = db
    .from("calls")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq("status", status);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    query = query
      .gte("created_at", getBusinessDayStartUTC(date))
      .lte("created_at", getBusinessDayEndUTC(date));
  }

  const { data: calls, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ calls, total: count ?? 0, page });
}

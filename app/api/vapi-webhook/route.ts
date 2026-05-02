import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { VapiWebhookPayload } from "@/types";

async function handleCallStarted(
  db: ReturnType<typeof createServiceClient>,
  call: { id: string; phoneNumber: string; startedAt: string }
) {
  await db.from("calls").insert({
    vapi_call_id: call.id,
    caller_phone: call.phoneNumber,
    status: "active",
    started_at: call.startedAt,
  });
}

async function handleCallEnded(
  db: ReturnType<typeof createServiceClient>,
  call: {
    id: string;
    phoneNumber: string;
    startedAt: string;
    endedAt: string;
    duration: number;
    transcript: string;
    summary: string;
    recordingUrl: string;
    endReason: string;
  }
) {
  const { data: existing } = await db
    .from("calls")
    .select("id")
    .eq("vapi_call_id", call.id)
    .single();

  if (existing) {
    await db
      .from("calls")
      .update({
        status: "completed",
        duration: call.duration,
        transcript: call.transcript,
        summary: call.summary,
        recording_url: call.recordingUrl,
        end_reason: call.endReason,
        ended_at: call.endedAt,
      })
      .eq("vapi_call_id", call.id);
  } else {
    await db.from("calls").insert({
      vapi_call_id: call.id,
      caller_phone: call.phoneNumber,
      status: "completed",
      duration: call.duration,
      transcript: call.transcript,
      summary: call.summary,
      recording_url: call.recordingUrl,
      end_reason: call.endReason,
      started_at: call.startedAt,
      ended_at: call.endedAt,
    });
  }

  // Update daily analytics snapshot
  const today = new Date().toISOString().split("T")[0];
  const { data: analytics } = await db
    .from("analytics")
    .select("*")
    .eq("date", today)
    .single();

  if (analytics) {
    await db
      .from("analytics")
      .update({
        completed_calls: analytics.completed_calls + 1,
        total_calls: analytics.total_calls + 1,
      })
      .eq("date", today);
  } else {
    await db.from("analytics").insert({
      date: today,
      total_calls: 1,
      completed_calls: 1,
    });
  }
}

async function handleToolCall(
  db: ReturnType<typeof createServiceClient>,
  tool: { name: string; parameters: Record<string, string> },
  callId: string
) {
  const { data: call } = await db
    .from("calls")
    .select("id")
    .eq("vapi_call_id", callId)
    .single();

  const callUuid = call?.id ?? null;

  if (tool.name === "bookClass") {
    const { memberName, memberPhone, className, classTime } = tool.parameters;
    await db.from("bookings").insert({
      call_id: callUuid,
      member_name: memberName,
      member_phone: memberPhone,
      class_name: className,
      class_time: classTime,
      status: "confirmed",
    });
    if (callUuid) {
      await db
        .from("calls")
        .update({ booking_made: true })
        .eq("id", callUuid);
    }
  }

  if (tool.name === "saveLead") {
    const { name, phone, interest, notes } = tool.parameters;
    await db
      .from("members")
      .upsert(
        { call_id: callUuid, name, phone, interest, notes, status: "lead" },
        { onConflict: "phone" }
      );
    if (callUuid) {
      await db
        .from("calls")
        .update({ lead_captured: true })
        .eq("id", callUuid);
    }
  }

  if (tool.name === "getMemberInfo") {
    // read-only, no DB write needed
  }
}

async function handleMissedCall(
  db: ReturnType<typeof createServiceClient>,
  call: { id: string; phoneNumber: string; missedAt: string }
) {
  await db.from("calls").insert({
    vapi_call_id: call.id,
    caller_phone: call.phoneNumber,
    status: "missed",
    started_at: call.missedAt,
  });

  const today = new Date().toISOString().split("T")[0];
  const { data: analytics } = await db
    .from("analytics")
    .select("*")
    .eq("date", today)
    .single();

  if (analytics) {
    await db
      .from("analytics")
      .update({
        missed_calls: analytics.missed_calls + 1,
        total_calls: analytics.total_calls + 1,
      })
      .eq("date", today);
  } else {
    await db.from("analytics").insert({
      date: today,
      total_calls: 1,
      missed_calls: 1,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body: VapiWebhookPayload = await request.json();
    const db = createServiceClient();

    switch (body.event) {
      case "call.started":
        await handleCallStarted(db, body.call);
        break;
      case "call.ended":
        await handleCallEnded(db, body.call);
        break;
      case "tool.called":
        await handleToolCall(db, body.tool, body.callId);
        break;
      case "call.missed":
        await handleMissedCall(db, body.call);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

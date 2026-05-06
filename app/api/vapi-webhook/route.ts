import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "edge";

type DB = ReturnType<typeof createServiceClient>;

// ─── tool execution ────────────────────────────────────────────────────────

async function executeToolCall(
  db: DB,
  name: string,
  args: Record<string, string>,
  vapiCallId: string | null
): Promise<string> {
  if (name === "bookClass") {
    const { memberName, memberPhone, className, classTime } = args;

    let classTimestamp: string;
    try {
      const parsed = new Date(classTime);
      classTimestamp = isNaN(parsed.getTime()) ? new Date(Date.now() + 86400000).toISOString() : parsed.toISOString();
    } catch {
      classTimestamp = new Date(Date.now() + 86400000).toISOString();
    }

    // Fire DB writes in background — don't block Sara's response
    void (async () => {
      const { data: call } = vapiCallId
        ? await db.from("calls").select("id").eq("vapi_call_id", vapiCallId).single()
        : { data: null };
      const callUuid = call?.id ?? null;
      const { error } = await db.from("bookings").insert({
        call_id: callUuid,
        member_name: memberName,
        member_phone: memberPhone,
        class_name: className,
        class_time: classTimestamp,
        status: "confirmed",
      });
      if (error) console.error("[vapi-webhook] bookings insert error:", error);
      if (callUuid) {
        await db.from("calls").update({ booking_made: true }).eq("id", callUuid);
      }
    })();

    return `Booking confirmed for ${memberName} in ${className} on ${classTimestamp}.`;
  }

  if (name === "saveLead") {
    const { name: memberName, phone, interest, notes } = args;

    void (async () => {
      const { data: call } = vapiCallId
        ? await db.from("calls").select("id").eq("vapi_call_id", vapiCallId).single()
        : { data: null };
      const callUuid = call?.id ?? null;
      await db
        .from("members")
        .upsert(
          { call_id: callUuid, name: memberName, phone, interest, notes, status: "lead" },
          { onConflict: "phone" }
        );
      if (callUuid) {
        await db.from("calls").update({ lead_captured: true }).eq("id", callUuid);
      }
    })();

    return `Lead saved for ${memberName}.`;
  }

  if (name === "getMemberInfo") {
    const { phone } = args;
    const { data: member } = await db
      .from("members")
      .select("name, status, interest")
      .eq("phone", phone)
      .single();
    if (!member) return "Member not found.";
    return `Found member: ${member.name}, status: ${member.status}, interest: ${member.interest ?? "not specified"}.`;
  }

  return "Tool executed.";
}

// ─── call event handlers ───────────────────────────────────────────────────

function extractCallerPhone(call: Record<string, unknown>): string | null {
  // Phone calls: caller number is in call.customer.number
  // Web calls: call.phoneNumber is a string (or absent)
  const customer = call.customer as Record<string, unknown> | undefined;
  if (customer?.number) return customer.number as string;
  if (typeof call.phoneNumber === "string") return call.phoneNumber || null;
  return null;
}

async function handleCallStarted(db: DB, call: Record<string, unknown>) {
  await db.from("calls").insert({
    vapi_call_id: call.id as string,
    caller_phone: extractCallerPhone(call),
    status: "active",
    started_at: (call.startedAt as string) ?? new Date().toISOString(),
  });
}

async function handleCallEnded(db: DB, call: Record<string, unknown>) {
  const id = call.id as string;
  const payload = {
    status: "completed",
    duration: call.duration as number ?? null,
    transcript: call.transcript as string ?? null,
    summary: call.summary as string ?? null,
    recording_url: call.recordingUrl as string ?? null,
    end_reason: call.endReason as string ?? null,
    ended_at: call.endedAt as string ?? new Date().toISOString(),
  };

  const { data: existing } = await db.from("calls").select("id").eq("vapi_call_id", id).single();

  if (existing) {
    await db.from("calls").update(payload).eq("vapi_call_id", id);
  } else {
    await db.from("calls").insert({
      vapi_call_id: id,
      caller_phone: extractCallerPhone(call),
      started_at: call.startedAt as string ?? null,
      ...payload,
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const { data: analytics } = await db.from("analytics").select("*").eq("date", today).single();
  if (analytics) {
    await db
      .from("analytics")
      .update({ completed_calls: analytics.completed_calls + 1, total_calls: analytics.total_calls + 1 })
      .eq("date", today);
  } else {
    await db.from("analytics").insert({ date: today, total_calls: 1, completed_calls: 1 });
  }
}

async function handleMissedCall(db: DB, call: Record<string, unknown>) {
  await db.from("calls").insert({
    vapi_call_id: call.id as string,
    caller_phone: extractCallerPhone(call),
    status: "missed",
    started_at: (call.missedAt as string) ?? new Date().toISOString(),
  });

  const today = new Date().toISOString().split("T")[0];
  const { data: analytics } = await db.from("analytics").select("*").eq("date", today).single();
  if (analytics) {
    await db
      .from("analytics")
      .update({ missed_calls: analytics.missed_calls + 1, total_calls: analytics.total_calls + 1 })
      .eq("date", today);
  } else {
    await db.from("analytics").insert({ date: today, total_calls: 1, missed_calls: 1 });
  }
}

// ─── main handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const db = createServiceClient();

    // ── Format A: Vapi server-message format (used when serverUrl is set on assistant)
    // Vapi sends { message: { type: "tool-calls" | "status-update" | ... }, call: {...} }
    const msg = body.message as Record<string, unknown> | undefined;
    if (msg) {
      const call = body.call as Record<string, unknown> | undefined;
      const callId = (call?.id ?? null) as string | null;

      if (msg.type === "tool-calls") {
        type ToolCallItem = {
          id: string;
          function: { name: string; arguments: string | Record<string, string> };
        };
        const toolCallList = (msg.toolCallList as ToolCallItem[]) ?? [];

        const results = await Promise.all(
          toolCallList.map(async (tc) => {
            const args =
              typeof tc.function.arguments === "string"
                ? (JSON.parse(tc.function.arguments) as Record<string, string>)
                : tc.function.arguments;
            const result = await executeToolCall(db, tc.function.name, args, callId);
            return { toolCallId: tc.id, result };
          })
        );

        return NextResponse.json({ results });
      }

      if (msg.type === "status-update" || msg.type === "call-start") {
        const status = msg.status as string | undefined;
        if (status === "in-progress" && call) void handleCallStarted(db, call);
        if ((status === "ended" || status === "error") && call) void handleCallEnded(db, call);
      }

      if (msg.type === "end-of-call-report" && call) {
        void handleCallEnded(db, { ...call, ...(msg as Record<string, unknown>) });
      }

      return NextResponse.json({});
    }

    // ── Format B: Vapi webhook-event format (used when webhook URL is set in Vapi dashboard)
    // Vapi sends { event: "call.started" | "call.ended" | "tool.called" | "call.missed", ... }
    const event = body.event as string | undefined;

    if (event === "call.started") {
      void handleCallStarted(db, body.call as Record<string, unknown>);
    } else if (event === "call.ended") {
      void handleCallEnded(db, body.call as Record<string, unknown>);
    } else if (event === "tool.called") {
      const tool = body.tool as { name: string; parameters: Record<string, string>; toolCallId?: string };
      const callId = body.callId as string ?? null;
      const result = await executeToolCall(db, tool.name, tool.parameters, callId);
      if (tool.toolCallId) {
        return NextResponse.json({ results: [{ toolCallId: tool.toolCallId, result }] });
      }
    } else if (event === "call.missed") {
      void handleMissedCall(db, body.call as Record<string, unknown>);
    }

    return NextResponse.json({});
  } catch (error) {
    console.error("[vapi-webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

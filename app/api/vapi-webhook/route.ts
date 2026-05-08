import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { addCalendarEvent, appendLeadToSheet } from "@/lib/google";

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

    const { data: call } = vapiCallId
      ? await db.from("calls").select("id").eq("vapi_call_id", vapiCallId).single()
      : { data: null };
    const callUuid = call?.id ?? null;
    const [dbResult, calendarResult] = await Promise.allSettled([
      db.from("bookings").insert({
        call_id: callUuid,
        member_name: memberName,
        member_phone: memberPhone,
        class_name: className,
        class_time: classTimestamp,
        status: "confirmed",
      }),
      addCalendarEvent({ memberName, memberPhone, className, classTime: classTimestamp }),
    ]);

    if (dbResult.status === "rejected" || (dbResult.status === "fulfilled" && dbResult.value?.error)) {
      console.error("[vapi-webhook] bookings insert error:", dbResult.status === "rejected" ? dbResult.reason : dbResult.value.error);
    }
    if (calendarResult.status === "rejected") {
      console.error("[vapi-webhook] Google Calendar error:", calendarResult.reason);
    }
    if (callUuid) {
      await db.from("calls").update({ booking_made: true }).eq("id", callUuid);
    }

    // Increment analytics bookings_made for today
    const today = new Date().toISOString().split("T")[0];
    const { data: analyticsRow } = await db.from("analytics").select("*").eq("date", today).single();
    if (analyticsRow) {
      await db.from("analytics").update({ bookings_made: (analyticsRow.bookings_made ?? 0) + 1 }).eq("date", today);
    } else {
      await db.from("analytics").insert({ date: today, total_calls: 0, completed_calls: 0, bookings_made: 1 });
    }

    return `Booking confirmed for ${memberName} in ${className} on ${classTimestamp}.`;
  }

  if (name === "saveLead") {
    const { name: memberName, phone, interest, notes } = args;

    const { data: call } = vapiCallId
      ? await db.from("calls").select("id").eq("vapi_call_id", vapiCallId).single()
      : { data: null };
    const callUuid = call?.id ?? null;

    const [, sheetResult] = await Promise.allSettled([
      db.from("members").upsert(
        { call_id: callUuid, name: memberName, phone, interest, notes, status: "lead" },
        { onConflict: "phone" }
      ),
      appendLeadToSheet({ name: memberName, phone, interest: interest ?? "", notes: notes ?? "" }),
    ]);

    if (sheetResult.status === "rejected") {
      console.error("[vapi-webhook] Google Sheets error:", sheetResult.reason);
    }
    if (callUuid) {
      await db.from("calls").update({ lead_captured: true }).eq("id", callUuid);
    }

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

async function fetchTwilioCost(callerPhone: string | null, startedAt: string | null): Promise<number | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !callerPhone || !startedAt) return null;

  try {
    const callTime = new Date(startedAt);
    // Query Twilio for inbound calls from this number on this date
    const dateStr = callTime.toISOString().split("T")[0];
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?From=${encodeURIComponent(callerPhone)}&StartTime>=${dateStr}&PageSize=50`;
    const creds = btoa(`${sid}:${token}`);
    const res = await fetch(url, { headers: { Authorization: `Basic ${creds}` } });
    if (!res.ok) return null;

    const json = await res.json() as { calls?: Array<{ start_time: string; price: string | null }> };
    const twCalls = json.calls ?? [];

    for (const tw of twCalls) {
      if (!tw.price) continue;
      const twTime = new Date(tw.start_time).getTime();
      if (Math.abs(twTime - callTime.getTime()) <= 120000) {
        return Math.abs(parseFloat(tw.price));
      }
    }
    return null;
  } catch {
    return null;
  }
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

  // successEvaluation comes as "true"/"false" string or boolean from Vapi analysisPlan
  const rawEval = call.successEvaluation;
  const successEval = rawEval === true || rawEval === "true" || rawEval === "True"
    ? true
    : rawEval === false || rawEval === "false" || rawEval === "False"
    ? false
    : null;

  const payload = {
    status: "completed",
    duration: call.duration as number ?? null,
    transcript: call.transcript as string ?? null,
    summary: call.summary as string ?? null,
    success_evaluation: successEval,
    structured_data: (call.structuredData as Record<string, unknown>) ?? null,
    recording_url: call.recordingUrl as string ?? null,
    end_reason: call.endReason as string ?? null,
    ended_at: call.endedAt as string ?? new Date().toISOString(),
    cost: call.cost as number ?? null,
    cost_breakdown: (call.costBreakdown as Record<string, unknown>) ?? null,
  };

  const callerPhone = extractCallerPhone(call);
  const startedAt = call.startedAt as string ?? null;

  const { data: existing } = await db.from("calls").select("id").eq("vapi_call_id", id).single();

  if (existing) {
    await db.from("calls").update(payload).eq("vapi_call_id", id);
  } else {
    await db.from("calls").insert({
      vapi_call_id: id,
      caller_phone: callerPhone,
      started_at: startedAt,
      ...payload,
    });
  }

  // Fetch real Twilio cost and store it (best-effort, non-blocking to response)
  const twilioCost = await fetchTwilioCost(callerPhone, startedAt);
  if (twilioCost !== null) {
    await db.from("calls").update({ twilio_cost: twilioCost }).eq("vapi_call_id", id);
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
        if (status === "in-progress" && call) await handleCallStarted(db, call);
        if ((status === "ended" || status === "error") && call) await handleCallEnded(db, call);
      }

      if (msg.type === "end-of-call-report" && call) {
        await handleCallEnded(db, { ...call, ...(msg as Record<string, unknown>) });
      }

      return NextResponse.json({});
    }

    // ── Format B: Vapi webhook-event format (used when webhook URL is set in Vapi dashboard)
    // Vapi sends { event: "call.started" | "call.ended" | "tool.called" | "call.missed", ... }
    const event = body.event as string | undefined;

    if (event === "call.started") {
      await handleCallStarted(db, body.call as Record<string, unknown>);
    } else if (event === "call.ended") {
      await handleCallEnded(db, body.call as Record<string, unknown>);
    } else if (event === "tool.called") {
      const tool = body.tool as { name: string; parameters: Record<string, string>; toolCallId?: string };
      const callId = body.callId as string ?? null;
      const result = await executeToolCall(db, tool.name, tool.parameters, callId);
      if (tool.toolCallId) {
        return NextResponse.json({ results: [{ toolCallId: tool.toolCallId, result }] });
      }
    } else if (event === "call.missed") {
      await handleMissedCall(db, body.call as Record<string, unknown>);
    }

    return NextResponse.json({});
  } catch (error) {
    console.error("[vapi-webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

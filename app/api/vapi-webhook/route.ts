import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { addCalendarEvent, appendLeadToSheet } from "@/lib/google";
import { Resend } from "resend";

type DB = ReturnType<typeof createServiceClient>;

// ─── notifications ─────────────────────────────────────────────────────────

async function sendBookingSMS(to: string, memberName: string, className: string, classTime: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return;

  const date = new Date(classTime).toLocaleString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  });

  const body = `Hi ${memberName}! ✅ Your ${className} class at PowerFit is confirmed for ${date}. See you then! Reply STOP to opt out.`;

  const creds = btoa(`${sid}:${token}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
}

async function sendBookingEmail(memberName: string, memberPhone: string, className: string, classTime: string, memberEmail?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const ownerEmail = process.env.RESEND_NOTIFY_EMAIL;
  if (!apiKey) return;
  const recipients = [ownerEmail, memberEmail].filter((e): e is string => Boolean(e));
  if (recipients.length === 0) return;
  const to = recipients.length === 1 ? recipients[0] : recipients;

  const date = new Date(classTime).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  });

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    subject: `New Booking: ${memberName} — ${className}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1d4ed8;margin-bottom:4px">New Booking Confirmed</h2>
        <p style="color:#6b7280;margin-top:0">PowerFit AI Receptionist</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#6b7280;width:120px">Member</td><td style="padding:6px 0;font-weight:600">${memberName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Phone</td><td style="padding:6px 0">${memberPhone}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Class</td><td style="padding:6px 0;font-weight:600">${className}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Date & Time</td><td style="padding:6px 0">${date}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
        <p style="color:#9ca3af;font-size:12px">Sent by Sara, PowerFit AI Receptionist</p>
      </div>
    `,
  });
}

// ─── tool execution ────────────────────────────────────────────────────────

async function executeToolCall(
  db: DB,
  name: string,
  args: Record<string, string>,
  vapiCallId: string | null
): Promise<string> {
  if (name === "bookClass") {
    const { memberName, memberPhone, memberEmail, className, classTime } = args;

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
    const [dbResult, calendarResult, smsResult, emailResult] = await Promise.allSettled([
      db.from("bookings").insert({
        call_id: callUuid,
        member_name: memberName,
        member_phone: memberPhone,
        member_email: memberEmail ?? null,
        class_name: className,
        class_time: classTimestamp,
        status: "confirmed",
      }),
      addCalendarEvent({ memberName, memberPhone, memberEmail, className, classTime: classTimestamp }),
      sendBookingSMS(memberPhone, memberName, className, classTimestamp),
      sendBookingEmail(memberName, memberPhone, className, classTimestamp, memberEmail),
    ]);

    if (dbResult.status === "rejected" || (dbResult.status === "fulfilled" && dbResult.value?.error)) {
      console.error("[vapi-webhook] bookings insert error:", dbResult.status === "rejected" ? dbResult.reason : dbResult.value.error);
    }
    if (calendarResult.status === "rejected") {
      console.error("[vapi-webhook] Google Calendar error:", calendarResult.reason);
    }
    if (smsResult.status === "rejected") {
      console.error("[vapi-webhook] SMS error:", smsResult.reason);
    }
    if (emailResult.status === "rejected") {
      console.error("[vapi-webhook] Email error:", emailResult.reason);
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
    const { name: memberName, phone, email, interest, notes } = args;

    const { data: call } = vapiCallId
      ? await db.from("calls").select("id").eq("vapi_call_id", vapiCallId).single()
      : { data: null };
    const callUuid = call?.id ?? null;

    const [, sheetResult] = await Promise.allSettled([
      db.from("members").upsert(
        { call_id: callUuid, name: memberName, phone, email: email ?? null, interest, notes, status: "lead" },
        { onConflict: "phone" }
      ),
      appendLeadToSheet({ name: memberName, phone, email: email ?? undefined, interest: interest ?? "", notes: notes ?? "" }),
    ]);

    if (sheetResult.status === "rejected") {
      console.error("[vapi-webhook] Google Sheets error:", sheetResult.reason);
    }
    if (callUuid) {
      await db.from("calls").update({ lead_captured: true }).eq("id", callUuid);
    }

    // Increment analytics leads_captured for today
    const today = new Date().toISOString().split("T")[0];
    const { data: analyticsRow } = await db.from("analytics").select("*").eq("date", today).single();
    if (analyticsRow) {
      await db.from("analytics").update({ leads_captured: (analyticsRow.leads_captured ?? 0) + 1 }).eq("date", today);
    } else {
      await db.from("analytics").insert({ date: today, total_calls: 0, completed_calls: 0, leads_captured: 1 });
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

  // Normalize messages from end-of-call-report into chat-bubble format
  type RawMsg = { role?: string; message?: string; content?: string; secondsFromStart?: number };
  const rawMsgs = (call.messages as RawMsg[] | undefined) ?? [];
  const messages = rawMsgs
    .filter((m) => m.role === "assistant" || m.role === "user")
    .map((m) => ({
      role: m.role as string,
      content: (m.message ?? m.content ?? "") as string,
      secondsFromStart: m.secondsFromStart ?? null,
    }));

  const payload = {
    status: "completed",
    duration: call.duration as number ?? null,
    transcript: call.transcript as string ?? null,
    messages: messages.length ? messages : null,
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

  // Fire-and-forget: fetch Twilio cost without blocking analytics update
  fetchTwilioCost(callerPhone, startedAt).then((cost) => {
    if (cost !== null) db.from("calls").update({ twilio_cost: cost }).eq("vapi_call_id", id);
  }).catch(() => { /* ignore */ });

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
    // Vapi sends { message: { type: "tool-calls" | "status-update" | ..., call: {...} } }
    // call is inside body.message, not at top-level body.call
    const msg = body.message as Record<string, unknown> | undefined;
    if (msg) {
      const call = (msg.call ?? body.call) as Record<string, unknown> | undefined;
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

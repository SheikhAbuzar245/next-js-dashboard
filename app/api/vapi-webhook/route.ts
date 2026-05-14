import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase";
import { addCalendarEvent, appendLeadToSheet } from "@/lib/google";
import { sendBookingSMS } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import {
  bookingConfirmedMember,
  bookingConfirmedOwner,
  leadCapturedLead,
  leadCapturedOwner,
} from "@/lib/email-templates";
import { getBusinessDateStr } from "@/lib/utils";

// ─── webhook auth ──────────────────────────────────────────────────────────
// Vapi sends a shared secret in the `X-Vapi-Secret` header. Configure it
// under Vapi dashboard → Org → Server URL → Secret, and mirror to
// VAPI_WEBHOOK_SECRET here. If the env var is unset we log loudly and accept
// requests so local dev keeps working; production should always have it set.

function verifyVapiSecret(request: Request): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) {
    console.warn("[vapi-webhook] VAPI_WEBHOOK_SECRET not set — accepting unsigned request. Set this env var in production.");
    return true;
  }
  const provided = request.headers.get("x-vapi-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type DB = ReturnType<typeof createServiceClient>;

// ─── post-call email orchestration ─────────────────────────────────────────
// All booking + lead emails are sent from handleCallEnded, not from the
// bookClass/saveLead tool handlers. That keeps Sara's tool-call responses
// snappy (no Resend latency mid-call) and means emails land in the caller's
// inbox right after they hang up. Idempotent via the email_sent_at flag on
// bookings and members, so a redelivered call.ended doesn't double-send.

async function sendPostCallEmails(db: DB, callRowId: string): Promise<void> {
  const ownerEmail = process.env.RESEND_NOTIFY_EMAIL ?? null;

  // ── Bookings ────────────────────────────────────────────────────────────
  const { data: bookings } = await db
    .from("bookings")
    .select("id, member_name, member_phone, member_email, class_name, class_time")
    .eq("call_id", callRowId)
    .is("email_sent_at", null);

  for (const b of bookings ?? []) {
    const sends: Promise<unknown>[] = [];

    if (b.member_email) {
      const tpl = bookingConfirmedMember({
        memberName: b.member_name,
        className: b.class_name,
        classTime: b.class_time,
      });
      sends.push(sendEmail({ to: b.member_email, subject: tpl.subject, html: tpl.html }));
    }

    if (ownerEmail) {
      const tpl = bookingConfirmedOwner({
        memberName: b.member_name,
        memberPhone: b.member_phone,
        memberEmail: b.member_email ?? null,
        className: b.class_name,
        classTime: b.class_time,
      });
      sends.push(sendEmail({ to: ownerEmail, subject: tpl.subject, html: tpl.html }));
    }

    await Promise.allSettled(sends);
    await db.from("bookings").update({ email_sent_at: new Date().toISOString() }).eq("id", b.id);
  }

  // ── Leads (members with status='lead' captured during this call) ────────
  const { data: leads } = await db
    .from("members")
    .select("id, name, phone, email, interest, notes, status")
    .eq("call_id", callRowId)
    .eq("status", "lead")
    .is("email_sent_at", null);

  for (const l of leads ?? []) {
    const sends: Promise<unknown>[] = [];

    if (l.email) {
      const tpl = leadCapturedLead({ name: l.name ?? "there", interest: l.interest });
      sends.push(sendEmail({ to: l.email, subject: tpl.subject, html: tpl.html }));
    }

    if (ownerEmail) {
      const tpl = leadCapturedOwner({
        name: l.name ?? "Unknown",
        phone: l.phone ?? "",
        email: l.email ?? null,
        interest: l.interest,
        notes: l.notes,
      });
      sends.push(sendEmail({ to: ownerEmail, subject: tpl.subject, html: tpl.html }));
    }

    await Promise.allSettled(sends);
    await db.from("members").update({ email_sent_at: new Date().toISOString() }).eq("id", l.id);
  }
}

// ─── analytics (fire-and-forget, never blocks the Vapi response) ───────────

function bumpAnalytics(
  db: DB,
  increments: Partial<Record<"total_calls" | "completed_calls" | "missed_calls" | "bookings_made" | "leads_captured", number>>
): void {
  const today = getBusinessDateStr();
  void (async () => {
    try {
      await db.rpc("increment_analytics", {
        p_date: today,
        p_total_calls:     increments.total_calls     ?? 0,
        p_completed_calls: increments.completed_calls ?? 0,
        p_missed_calls:    increments.missed_calls    ?? 0,
        p_bookings_made:   increments.bookings_made   ?? 0,
        p_leads_captured:  increments.leads_captured  ?? 0,
      });
    } catch (e) { console.error("[vapi-webhook] analytics rpc error:", e); }
  })();
}

// ─── tool execution ────────────────────────────────────────────────────────

async function executeToolCall(
  db: DB,
  name: string,
  args: Record<string, string>,
  vapiCallId: string | null
): Promise<string> {

  // ── checkAvailability ──────────────────────────────────────────────────
  if (name === "checkAvailability") {
    const { className } = args;

    let query = db
      .from("classes")
      .select("name, instructor, schedule, capacity")
      .eq("is_active", true);

    if (className) query = query.ilike("name", `%${className}%`);

    const { data: classes } = await query.order("name");

    if (!classes || classes.length === 0) {
      return className
        ? `No class found matching "${className}". Available classes are: Yoga, CrossFit, Spinning, Boxing, Pilates, HIIT.`
        : "No active classes available at this time.";
    }

    const lines = classes.map((c) => {
      const s = c.schedule as { day?: string; time?: string } | null;
      const when = s?.day && s?.time ? `${s.day} at ${s.time}` : "schedule TBD";
      return `${c.name}${c.instructor ? ` with ${c.instructor}` : ""} — ${when} (capacity: ${c.capacity})`;
    });

    return `Available classes:\n${lines.join("\n")}`;
  }

  // ── bookClass ──────────────────────────────────────────────────────────
  if (name === "bookClass") {
    const { memberName, memberPhone, memberEmail, className, classTime } = args;

    // Reject malformed dates instead of silently substituting "tomorrow same
    // time" — the AI must re-prompt the caller for a valid date.
    const parsed = classTime ? new Date(classTime) : null;
    if (!parsed || isNaN(parsed.getTime())) {
      return "I didn't quite catch the date and time — could you say the day and time you'd like to book?";
    }
    const classTimestamp = parsed.toISOString();

    // Look up call UUID for FK reference
    const { data: callRow } = vapiCallId
      ? await db.from("calls").select("id").eq("vapi_call_id", vapiCallId).maybeSingle()
      : { data: null };

    // ── Critical path: DB insert only ────────────────────────────────────
    const { error: bookingError } = await db.from("bookings").insert({
      call_id: callRow?.id ?? null,
      member_name: memberName,
      member_phone: memberPhone,
      member_email: memberEmail ?? null,
      class_name: className,
      class_time: classTimestamp,
      status: "confirmed",
    });

    if (bookingError) {
      console.error("[vapi-webhook] bookings insert error:", bookingError);
      return "I'm sorry, I wasn't able to complete the booking due to a technical issue. Please call us back and we'll get you sorted!";
    }

    // Await SMS + calendar before returning so the function instance stays
    // alive long enough to deliver them. Email is intentionally NOT sent
    // here — it fires post-call from handleCallEnded → sendPostCallEmails
    // so it lands after the caller hangs up.
    const notifResults = await Promise.allSettled([
      addCalendarEvent({ memberName, memberPhone, memberEmail, className, classTime: classTimestamp }),
      sendBookingSMS(memberPhone, memberName, className, classTimestamp),
    ]);
    const notifLabels = ["calendar", "SMS"];
    notifResults.forEach((r, i) => {
      if (r.status === "rejected") console.error(`[vapi-webhook] ${notifLabels[i]} error:`, r.reason);
    });

    // ── Fire-and-forget: mark call as booked (by vapi_call_id, avoids race) ──
    if (vapiCallId) {
      void (async () => {
        try {
          await db.from("calls").update({ booking_made: true }).eq("vapi_call_id", vapiCallId);
        } catch { /* ignore */ }
      })();
    }

    // ── Fire-and-forget: analytics ────────────────────────────────────────
    bumpAnalytics(db, { bookings_made: 1 });

    return `Booking confirmed for ${memberName} in ${className} on ${classTimestamp}.`;
  }

  // ── saveLead ───────────────────────────────────────────────────────────
  if (name === "saveLead") {
    const { name: memberName, phone, email, interest, notes } = args;

    const { data: callRow } = vapiCallId
      ? await db.from("calls").select("id").eq("vapi_call_id", vapiCallId).maybeSingle()
      : { data: null };

    // ── Critical path: DB upsert only ────────────────────────────────────
    const { error: leadError } = await db.from("members").upsert(
      {
        call_id: callRow?.id ?? null,
        name: memberName,
        phone,
        email: email ?? null,
        interest: interest ?? null,
        notes: notes ?? null,
        status: "lead",
      },
      { onConflict: "phone" }
    );

    if (leadError) {
      console.error("[vapi-webhook] saveLead error:", leadError);
    }

    // ── Fire-and-forget: Google Sheets ────────────────────────────────────
    void (async () => {
      try {
        await appendLeadToSheet({
          name: memberName,
          phone,
          email: email ?? undefined,
          interest: interest ?? "",
          notes: notes ?? "",
        });
      } catch (e) { console.error("[vapi-webhook] Google Sheets error:", e); }
    })();

    // ── Fire-and-forget: mark call as lead captured ───────────────────────
    if (vapiCallId) {
      void (async () => {
        try {
          await db.from("calls").update({ lead_captured: true }).eq("vapi_call_id", vapiCallId);
        } catch { /* ignore */ }
      })();
    }

    // ── Fire-and-forget: analytics ────────────────────────────────────────
    bumpAnalytics(db, { leads_captured: 1 });

    return `Lead saved for ${memberName}.`;
  }

  // ── getMemberInfo ──────────────────────────────────────────────────────
  if (name === "getMemberInfo") {
    const { phone } = args;
    const { data: member } = await db
      .from("members")
      .select("name, status, interest")
      .eq("phone", phone)
      .maybeSingle();
    if (!member) return "Member not found.";
    return `Found member: ${member.name}, status: ${member.status}, interest: ${member.interest ?? "not specified"}.`;
  }

  return "Tool executed.";
}

// ─── call event handlers ───────────────────────────────────────────────────

function extractCallerPhone(call: Record<string, unknown>): string | null {
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
  // Idempotent: Vapi can deliver status-update and call-start for the same call,
  // and may retry on transient errors. Upsert avoids unique-constraint 500s.
  await db.from("calls").upsert(
    {
      vapi_call_id: call.id as string,
      caller_phone: extractCallerPhone(call),
      status: "active",
      started_at: (call.startedAt as string) ?? new Date().toISOString(),
    },
    { onConflict: "vapi_call_id", ignoreDuplicates: true }
  );
}

async function handleCallEnded(db: DB, call: Record<string, unknown>) {
  const id = call.id as string;

  const rawEval = call.successEvaluation;
  const successEval =
    rawEval === true || rawEval === "true" || rawEval === "True"
      ? true
      : rawEval === false || rawEval === "false" || rawEval === "False"
      ? false
      : null;

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
    duration: (call.duration as number) ?? null,
    transcript: (call.transcript as string) ?? null,
    messages: messages.length ? messages : null,
    summary: (call.summary as string) ?? null,
    success_evaluation: successEval,
    structured_data: (call.structuredData as Record<string, unknown>) ?? null,
    recording_url: (call.recordingUrl as string) ?? null,
    end_reason: (call.endReason as string) ?? null,
    ended_at: (call.endedAt as string) ?? new Date().toISOString(),
    cost: (call.cost as number) ?? null,
    cost_breakdown: (call.costBreakdown as Record<string, unknown>) ?? null,
  };

  const callerPhone = extractCallerPhone(call);
  const startedAt = (call.startedAt as string) ?? null;

  const { data: existing } = await db
    .from("calls")
    .select("id, status")
    .eq("vapi_call_id", id)
    .maybeSingle();

  // Only count analytics on the first transition into 'completed' — protects
  // against duplicate call.ended deliveries and against the web-call client
  // POST having already counted this call.
  const wasAlreadyCompleted = existing?.status === "completed";

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

  // Resolve the call row UUID for downstream lookups (post-call emails).
  let callRowId = (existing?.id as string | undefined) ?? undefined;
  if (!callRowId) {
    const { data: fresh } = await db.from("calls").select("id").eq("vapi_call_id", id).maybeSingle();
    callRowId = (fresh?.id as string | undefined) ?? undefined;
  }

  // Fire-and-forget: Twilio cost
  void (async () => {
    try {
      const cost = await fetchTwilioCost(callerPhone, startedAt);
      if (cost !== null) await db.from("calls").update({ twilio_cost: cost }).eq("vapi_call_id", id);
    } catch { /* ignore */ }
  })();

  // Fire-and-forget: post-call emails (booking confirmations + lead follow-ups).
  // Idempotent via bookings.email_sent_at / members.email_sent_at, so duplicate
  // call.ended deliveries don't double-send.
  if (callRowId) {
    void sendPostCallEmails(db, callRowId).catch((e) =>
      console.error("[vapi-webhook] sendPostCallEmails error:", e)
    );
  }

  if (!wasAlreadyCompleted) {
    bumpAnalytics(db, { total_calls: 1, completed_calls: 1 });
  }
}

async function handleMissedCall(db: DB, call: Record<string, unknown>) {
  // Idempotent like handleCallStarted; avoid duplicate analytics bumps via the
  // ignoreDuplicates flag — analytics only fires if the row is newly inserted.
  const { data: inserted } = await db
    .from("calls")
    .upsert(
      {
        vapi_call_id: call.id as string,
        caller_phone: extractCallerPhone(call),
        status: "missed",
        started_at: (call.missedAt as string) ?? new Date().toISOString(),
      },
      { onConflict: "vapi_call_id", ignoreDuplicates: true }
    )
    .select("id");

  if (inserted && inserted.length > 0) {
    bumpAnalytics(db, { total_calls: 1, missed_calls: 1 });
  }
}

// ─── main handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!verifyVapiSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const db = createServiceClient();

    // ── Format A: Vapi server-message format ──────────────────────────────
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

    // ── Format B: Vapi webhook-event format ───────────────────────────────
    const event = body.event as string | undefined;

    if (event === "call.started") {
      await handleCallStarted(db, body.call as Record<string, unknown>);
    } else if (event === "call.ended") {
      await handleCallEnded(db, body.call as Record<string, unknown>);
    } else if (event === "tool.called") {
      const tool = body.tool as { name: string; parameters: Record<string, string>; toolCallId?: string };
      const callId = (body.callId as string) ?? null;
      const result = await executeToolCall(db, tool.name, tool.parameters, callId);
      // Always return the result (was missing return when toolCallId absent)
      return NextResponse.json({
        results: [{ toolCallId: tool.toolCallId ?? "unknown", result }],
      });
    } else if (event === "call.missed") {
      await handleMissedCall(db, body.call as Record<string, unknown>);
    }

    return NextResponse.json({});
  } catch (error) {
    console.error("[vapi-webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

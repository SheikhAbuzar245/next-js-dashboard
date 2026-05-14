#!/usr/bin/env node
/**
 * One-off backfill: pulls every Vapi call and inserts any that aren't in
 * Supabase yet. Idempotent — re-running only touches calls still missing.
 *
 *   node scripts/backfill-calls.mjs              (dry-run, prints diff)
 *   node scripts/backfill-calls.mjs --apply      (writes to Supabase)
 *
 * Reads VAPI_PRIVATE_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * from .env in the repo root.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env");
const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);

const VAPI_PRIVATE_KEY = env.VAPI_PRIVATE_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!VAPI_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars in .env"); process.exit(1);
}

const APPLY = process.argv.includes("--apply");

// ─── Fetch all Vapi calls (paginated) ──────────────────────────────────────
async function fetchAllVapiCalls() {
  const all = [];
  let cursor = null;
  while (true) {
    const url = new URL("https://api.vapi.ai/call");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("createdAtLt", cursor);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${VAPI_PRIVATE_KEY}` } });
    if (!res.ok) throw new Error(`Vapi /call: ${res.status} ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < 100) break;
    cursor = page[page.length - 1].createdAt;
  }
  return all;
}

// ─── Supabase REST helper ──────────────────────────────────────────────────
async function supa(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Build the insert payload, mirroring webhook handleCallEnded ──────────
function buildPayload(call) {
  const extractPhone = (c) => c.customer?.number ?? (typeof c.phoneNumber === "string" ? c.phoneNumber : null);
  const rawEval = call.analysis?.successEvaluation ?? call.successEvaluation;
  const successEval =
    rawEval === true || rawEval === "true" || rawEval === "True" ? true
    : rawEval === false || rawEval === "false" || rawEval === "False" ? false
    : null;

  const rawMsgs = call.messages ?? call.artifact?.messages ?? [];
  const messages = rawMsgs
    .filter((m) => m.role === "assistant" || m.role === "user")
    .map((m) => ({
      role: m.role,
      content: m.message ?? m.content ?? "",
      secondsFromStart: m.secondsFromStart ?? null,
    }));

  const isMissed = call.endedReason && /no-answer|busy|missed|failed/i.test(call.endedReason);
  const status = isMissed ? "missed" : (call.status === "ended" ? "completed" : (call.status ?? "completed"));

  return {
    vapi_call_id: call.id,
    caller_phone: extractPhone(call),
    status,
    started_at: call.startedAt ?? call.createdAt ?? null,
    ended_at: call.endedAt ?? call.updatedAt ?? null,
    duration: call.duration ?? (call.startedAt && call.endedAt
      ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : null),
    transcript: call.transcript ?? call.artifact?.transcript ?? null,
    messages: messages.length ? messages : null,
    summary: call.summary ?? call.analysis?.summary ?? null,
    success_evaluation: successEval,
    structured_data: call.analysis?.structuredData ?? call.structuredData ?? null,
    recording_url: call.recordingUrl ?? call.artifact?.recordingUrl ?? null,
    end_reason: call.endedReason ?? null,
    cost: call.cost ?? null,
    cost_breakdown: call.costBreakdown ?? null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────
const vapiCalls = await fetchAllVapiCalls();
console.log(`[backfill] Vapi has ${vapiCalls.length} calls total.`);

const supaIds = new Set(
  (await supa("calls?select=vapi_call_id&vapi_call_id=not.is.null")).map((r) => r.vapi_call_id)
);
console.log(`[backfill] Supabase has ${supaIds.size} calls with vapi_call_id.`);

const missing = vapiCalls.filter((c) => !supaIds.has(c.id));
console.log(`[backfill] Missing in Supabase: ${missing.length}`);
for (const c of missing) {
  console.log(`  - ${c.id}  ${c.createdAt}  ${c.customer?.number ?? "?"}  endedReason=${c.endedReason ?? "?"}`);
}

if (!APPLY) {
  console.log("\n[backfill] Dry run. Re-run with --apply to insert.");
  process.exit(0);
}

if (missing.length === 0) {
  console.log("\n[backfill] Nothing to do."); process.exit(0);
}

let ok = 0, err = 0;
for (const call of missing) {
  // Fetch full call detail (the list view omits transcript, cost, etc.)
  const detailRes = await fetch(`https://api.vapi.ai/call/${call.id}`, {
    headers: { Authorization: `Bearer ${VAPI_PRIVATE_KEY}` },
  });
  if (!detailRes.ok) {
    console.error(`  ✗ ${call.id} fetch failed: ${detailRes.status}`); err++; continue;
  }
  const detail = await detailRes.json();
  const payload = buildPayload(detail);
  try {
    await supa("calls", { method: "POST", body: JSON.stringify(payload) });
    console.log(`  ✓ ${call.id}  ${payload.status}  ${payload.duration ?? "?"}s`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${call.id}: ${e.message}`); err++;
  }
}

console.log(`\n[backfill] Inserted ${ok}, errors ${err}.`);

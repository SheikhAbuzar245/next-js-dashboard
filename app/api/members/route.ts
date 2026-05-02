import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const db = createServiceClient();
  let query = db
    .from("members")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: members, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members, total: count ?? 0 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, phone, email, interest, notes, callId } = body;

  const db = createServiceClient();
  const { data, error } = await db
    .from("members")
    .upsert(
      {
        call_id: callId ?? null,
        name,
        phone,
        email: email ?? null,
        interest: interest ?? null,
        notes: notes ?? null,
        status: "lead",
      },
      { onConflict: "phone" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

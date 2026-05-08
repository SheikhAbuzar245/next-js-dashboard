import { NextResponse } from "next/server";

const VAPI_API = "https://api.vapi.ai";
const ASSISTANT_NAME = "Sara - PowerFit Receptionist";

function auth() {
  return {
    Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function findAssistant(): Promise<{ id: string; model?: { systemPrompt?: string } } | null> {
  const res = await fetch(`${VAPI_API}/assistant`, { headers: auth() });
  if (!res.ok) return null;
  const list = await res.json();
  if (!Array.isArray(list)) return null;
  return list.find((a: { name: string }) => a.name === ASSISTANT_NAME) ?? null;
}

export async function GET() {
  try {
    const assistant = await findAssistant();
    if (!assistant) return NextResponse.json({ error: "Assistant not found" }, { status: 404 });

    const detailRes = await fetch(`${VAPI_API}/assistant/${assistant.id}`, { headers: auth() });
    const detail = await detailRes.json();
    return NextResponse.json({ systemPrompt: detail.model?.systemPrompt ?? "" });
  } catch {
    return NextResponse.json({ error: "Failed to load assistant" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { systemPrompt } = await request.json() as { systemPrompt: string };
    if (!systemPrompt?.trim()) {
      return NextResponse.json({ error: "System prompt cannot be empty" }, { status: 400 });
    }

    const assistant = await findAssistant();
    if (!assistant) return NextResponse.json({ error: "Assistant not found" }, { status: 404 });

    const res = await fetch(`${VAPI_API}/assistant/${assistant.id}`, {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ model: { systemPrompt } }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update assistant" }, { status: 500 });
  }
}

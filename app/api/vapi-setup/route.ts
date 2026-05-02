import { NextResponse } from "next/server";

const VAPI_API = "https://api.vapi.ai";

const SYSTEM_PROMPT = `You are Sara, the AI receptionist for PowerFit Gym.
Your job is to:
- Help members book fitness classes
- Answer questions about gym timings, pricing, and classes
- Capture details of new leads interested in membership
- Be friendly, natural, and concise

Always collect the caller's name and phone number.
When booking a class, confirm class name, date, and time.

Available classes: Yoga (Mon/Wed/Fri 6am), CrossFit (Tue/Thu/Sat 7am), Spinning (Mon/Wed/Fri 8am), Boxing (Mon/Tue/Thu 6pm), Pilates (Wed/Fri 7pm), HIIT (Daily 5:30am).
Membership pricing: Monthly PKR 5,000 | Quarterly PKR 13,000 | Annual PKR 45,000.
Gym hours: 5am–11pm weekdays, 6am–10pm weekends.`;

const ASSISTANT_NAME = "Sara - PowerFit Receptionist";

function authHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

// Registers a provider credential in Vapi if not already present
async function ensureCredential(
  privateKey: string,
  provider: string,
  apiKey: string
): Promise<void> {
  if (!apiKey) return;

  const listRes = await fetch(`${VAPI_API}/credential`, {
    headers: authHeaders(privateKey),
  });
  if (!listRes.ok) return;

  const creds = await listRes.json();
  const exists = Array.isArray(creds) && creds.some((c: { provider: string }) => c.provider === provider);
  if (exists) return;

  const res = await fetch(`${VAPI_API}/credential`, {
    method: "POST",
    headers: authHeaders(privateKey),
    body: JSON.stringify({ provider, apiKey }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[vapi-setup] Failed to register ${provider} credential:`, body);
  } else {
    console.log(`[vapi-setup] Registered ${provider} credential`);
  }
}

// Deletes an existing assistant by name so we can recreate it cleanly
async function deleteAssistantIfExists(privateKey: string): Promise<void> {
  const listRes = await fetch(`${VAPI_API}/assistant`, {
    headers: authHeaders(privateKey),
  });
  if (!listRes.ok) return;

  const assistants = await listRes.json();
  if (!Array.isArray(assistants)) return;

  const existing = assistants.find((a: { name: string }) => a.name === ASSISTANT_NAME);
  if (!existing) return;

  await fetch(`${VAPI_API}/assistant/${existing.id}`, {
    method: "DELETE",
    headers: authHeaders(privateKey),
  });
  console.log(`[vapi-setup] Deleted old assistant ${existing.id}`);
}

async function createAssistant(privateKey: string): Promise<string> {
  const body = {
    name: ASSISTANT_NAME,
    firstMessage:
      "Hello! Thank you for calling PowerFit Gym. This is Sara. How can I help you today?",
    model: {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.7,
    },
    voice: {
      provider: "11labs",
      voiceId: process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL",
      stability: 0.5,
      similarityBoost: 0.75,
    },
    // No custom transcriber — use Vapi's default (Deepgram built-in)
    endCallMessage: "Thank you for calling PowerFit Gym. Have a great day!",
    endCallPhrases: ["goodbye", "bye", "thank you bye", "that's all"],
    artifactPlan: {
      recordingEnabled: true,
      videoRecordingEnabled: false,
    },
  };

  const res = await fetch(`${VAPI_API}/assistant`, {
    method: "POST",
    headers: authHeaders(privateKey),
    body: JSON.stringify(body),
  });

  const assistant = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to create assistant (${res.status}): ${JSON.stringify(assistant)}`);
  }

  console.log(`[vapi-setup] Created assistant ${assistant.id}`);
  return assistant.id as string;
}

// In-memory cache so we don't hit Vapi API on every page load
let cachedAssistantId: string | null = null;

export async function GET() {
  try {
    // Return cached ID within the same process lifetime
    if (cachedAssistantId) {
      return NextResponse.json({ assistantId: cachedAssistantId });
    }

    // Also respect env override
    if (process.env.VAPI_ASSISTANT_ID) {
      cachedAssistantId = process.env.VAPI_ASSISTANT_ID;
      return NextResponse.json({ assistantId: cachedAssistantId });
    }

    const privateKey = process.env.VAPI_PRIVATE_KEY!;

    // 1. Register all provider credentials so Vapi can use them
    await Promise.all([
      ensureCredential(privateKey, "openrouter", process.env.OPENROUTER_API_KEY!),
      ensureCredential(privateKey, "11labs", process.env.ELEVENLABS_API_KEY!),
    ]);

    // 2. Delete old assistant (may have been created before credentials existed)
    await deleteAssistantIfExists(privateKey);

    // 3. Create fresh assistant
    cachedAssistantId = await createAssistant(privateKey);

    return NextResponse.json({ assistantId: cachedAssistantId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[vapi-setup] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

const VAPI_API = "https://api.vapi.ai";
const ASSISTANT_NAME = "Sara - PowerFit Receptionist";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function getAssistantId(): Promise<string | null> {
  if (process.env.VAPI_ASSISTANT_ID) return process.env.VAPI_ASSISTANT_ID;

  const res = await fetch(`${VAPI_API}/assistant`, { headers: authHeaders() });
  if (!res.ok) return null;

  const list = await res.json();
  const match = Array.isArray(list)
    ? list.find((a: { name: string }) => a.name === ASSISTANT_NAME)
    : null;
  return match?.id ?? null;
}

// GET — fetch current Twilio phone number status from Vapi
export async function GET() {
  try {
    const res = await fetch(`${VAPI_API}/phone-number`, { headers: authHeaders() });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch phone numbers from Vapi" }, { status: 500 });
    }

    const numbers = await res.json();
    const twilioNumber = Array.isArray(numbers)
      ? numbers.find((n: { provider: string }) => n.provider === "twilio")
      : null;

    return NextResponse.json({
      connected: !!twilioNumber,
      phoneNumber: twilioNumber?.number ?? null,
      phoneNumberId: twilioNumber?.id ?? null,
      assistantId: twilioNumber?.assistantId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — register Twilio number with Vapi and link to assistant
export async function POST(request: Request) {
  try {
    const { twilioAccountSid, twilioAuthToken, phoneNumber } = await request.json();

    if (!twilioAccountSid || !twilioAuthToken || !phoneNumber) {
      return NextResponse.json(
        { error: "twilioAccountSid, twilioAuthToken, and phoneNumber are required" },
        { status: 400 }
      );
    }

    const assistantId = await getAssistantId();

    const body: Record<string, unknown> = {
      provider: "twilio",
      number: phoneNumber,
      twilioAccountSid,
      twilioAuthToken,
    };

    if (assistantId) body.assistantId = assistantId;

    const res = await fetch(`${VAPI_API}/phone-number`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      phoneNumber: data.number,
      phoneNumberId: data.id,
      assistantId: data.assistantId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — unlink Twilio number from Vapi
export async function DELETE(request: Request) {
  try {
    const { phoneNumberId } = await request.json();

    if (!phoneNumberId) {
      return NextResponse.json({ error: "phoneNumberId is required" }, { status: 400 });
    }

    const res = await fetch(`${VAPI_API}/phone-number/${phoneNumberId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { Resend } from "resend";

// Single-purpose Resend wrapper. Reads env once, never throws — callers
// inspect the returned `ok` flag. Centralizing here so every email path
// uses the same FROM, same error handling, same skip-if-unset behaviour.

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

// Lazy: only construct the client when the first send happens, so importing
// this module in a test/dev context without RESEND_API_KEY doesn't blow up.
let client: Resend | null = null;
function getClient(): Resend | null {
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const c = getClient();
  if (!c) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  try {
    const res = await c.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (res.error) {
      console.error("[email] Resend error:", res.error);
      return { ok: false, error: res.error.message ?? String(res.error) };
    }
    return { ok: true, id: res.data?.id ?? "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] send threw:", msg);
    return { ok: false, error: msg };
  }
}

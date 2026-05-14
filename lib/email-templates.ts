// Email HTML templates. All templates return { subject, html }; the HTML
// uses inline CSS only (most email clients strip <style> blocks). All wrap
// through baseLayout for a consistent branded header + footer.
//
// Design notes (per the project plan):
// - Primary green #16a34a / accent blue #1d4ed8 match the dashboard palette
// - Max-width 560px, mobile-safe
// - No external images / logo files — text-only branding
// - Footer matches "Sara at PowerFit Gym" persona used in the FROM address

import { BUSINESS_TZ } from "@/lib/utils";

const GYM = {
  name: "PowerFit Gym",
  phone: "+1 (555) 000-0000",     // TODO: replace with real number
  hours: "Weekdays 5am–11pm · Weekends 6am–10pm",
  address: "PowerFit Gym",
};

type Template = { subject: string; html: string };

// ─── shared chrome ─────────────────────────────────────────────────────────

function baseLayout(opts: {
  preheader: string;
  headline: string;
  accent: "green" | "blue";
  body: string;
}): string {
  const accentColor = opts.accent === "green" ? "#16a34a" : "#1d4ed8";
  const fontStack = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${fontStack};">
  <!-- Preheader (hidden, shows in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3f4f6;opacity:0;">
    ${escapeHtml(opts.preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <!-- Header bar -->
          <tr>
            <td style="background:${accentColor};padding:20px 28px;">
              <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">
                ${escapeHtml(GYM.name)}
              </div>
              <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:2px;">
                ${escapeHtml(opts.headline)}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px;color:#1f2937;font-size:15px;line-height:1.55;">
              ${opts.body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 28px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
              <div><strong style="color:#374151;">${escapeHtml(GYM.name)}</strong></div>
              <div>${escapeHtml(GYM.hours)}</div>
              <div>Reach us: ${escapeHtml(GYM.phone)}</div>
              <div style="margin-top:10px;color:#9ca3af;">Sent by Sara, your AI receptionist. Reply if you need to reschedule.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatClassTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: BUSINESS_TZ,
    });
  } catch {
    return iso;
  }
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;">${escapeHtml(value)}</td>
    </tr>`;
}

// ─── templates ─────────────────────────────────────────────────────────────

export function bookingConfirmedMember(p: {
  memberName: string;
  className: string;
  classTime: string;
}): Template {
  const when = formatClassTime(p.classTime);
  const body = `
    <div style="font-size:13px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Booking Confirmed</div>
    <h1 style="margin:4px 0 18px 0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.01em;">
      You're all set, ${escapeHtml(p.memberName)}!
    </h1>
    <p style="margin:0 0 18px 0;color:#374151;">
      Your spot in <strong>${escapeHtml(p.className)}</strong> is locked in. See you on the mat.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 20px;margin:0 0 22px 0;">
      <div style="font-size:13px;color:#15803d;font-weight:600;margin-bottom:6px;">${escapeHtml(p.className)}</div>
      <div style="font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.01em;">${escapeHtml(when)}</div>
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px;">
      Need to reschedule? Just reply to this email or give us a call.
    </p>`;
  return {
    subject: `Your ${p.className} booking is confirmed`,
    html: baseLayout({
      preheader: `${p.className} — ${when}`,
      headline: "Your booking is confirmed",
      accent: "green",
      body,
    }),
  };
}

export function bookingConfirmedOwner(p: {
  memberName: string;
  memberPhone: string;
  memberEmail: string | null;
  className: string;
  classTime: string;
}): Template {
  const when = formatClassTime(p.classTime);
  const body = `
    <div style="font-size:13px;color:#1d4ed8;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">New Booking</div>
    <h1 style="margin:4px 0 18px 0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.01em;">
      ${escapeHtml(p.memberName)} just booked ${escapeHtml(p.className)}
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 6px 0;">
      ${detailRow("Member", p.memberName)}
      ${detailRow("Phone", p.memberPhone)}
      ${p.memberEmail ? detailRow("Email", p.memberEmail) : ""}
      ${detailRow("Class", p.className)}
      ${detailRow("When", when)}
    </table>`;
  return {
    subject: `New Booking: ${p.memberName} — ${p.className}`,
    html: baseLayout({
      preheader: `${p.memberName} booked ${p.className} for ${when}`,
      headline: "New booking confirmed",
      accent: "blue",
      body,
    }),
  };
}

export function leadCapturedLead(p: {
  name: string;
  interest: string | null;
}): Template {
  const interestLine = p.interest
    ? `Sara mentioned you were curious about <strong>${escapeHtml(p.interest)}</strong> — here's a quick recap so you have everything in one place.`
    : `Thanks for chatting with Sara today! Here's a quick recap of what we offer.`;

  const body = `
    <h1 style="margin:0 0 18px 0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.01em;">
      Great to hear from you, ${escapeHtml(p.name)}!
    </h1>
    <p style="margin:0 0 18px 0;color:#374151;">${interestLine}</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:18px 20px;margin:0 0 18px 0;">
      <div style="font-size:13px;color:#1d4ed8;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Membership</div>
      <div style="font-size:14px;color:#1f2937;line-height:1.7;">
        <strong>Monthly</strong> — $49<br/>
        <strong>Quarterly</strong> — $129<br/>
        <strong>Annual</strong> — $449 <span style="color:#16a34a;font-weight:600;">(best value)</span>
      </div>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;margin:0 0 22px 0;">
      <div style="font-size:13px;color:#374151;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Classes</div>
      <div style="font-size:14px;color:#1f2937;line-height:1.7;">
        Yoga · CrossFit · Spinning · Boxing · Pilates · HIIT
      </div>
    </div>

    <p style="margin:0 0 8px 0;color:#374151;">
      Ready to book a class or sign up? Just reply to this email or call us back — Sara remembers you.
    </p>`;
  return {
    subject: `Welcome to ${GYM.name}, ${p.name}!`,
    html: baseLayout({
      preheader: p.interest
        ? `Following up on your interest in ${p.interest}`
        : `Pricing and class info from your call`,
      headline: "Thanks for reaching out",
      accent: "blue",
      body,
    }),
  };
}

export function leadCapturedOwner(p: {
  name: string;
  phone: string;
  email: string | null;
  interest: string | null;
  notes: string | null;
}): Template {
  const body = `
    <div style="font-size:13px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">New Lead</div>
    <h1 style="margin:4px 0 18px 0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.01em;">
      ${escapeHtml(p.name)} just left their details
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 18px 0;">
      ${detailRow("Name", p.name)}
      ${detailRow("Phone", p.phone)}
      ${p.email ? detailRow("Email", p.email) : ""}
      ${p.interest ? detailRow("Interested in", p.interest) : ""}
    </table>
    ${
      p.notes
        ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 6px 0;">
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em;">Notes</div>
            <div style="font-size:14px;color:#1f2937;">${escapeHtml(p.notes)}</div>
          </div>`
        : ""
    }`;
  return {
    subject: `New Lead: ${p.name}${p.interest ? ` — ${p.interest}` : ""}`,
    html: baseLayout({
      preheader: `${p.name} · ${p.phone}${p.interest ? ` · ${p.interest}` : ""}`,
      headline: "New lead captured",
      accent: "blue",
      body,
    }),
  };
}

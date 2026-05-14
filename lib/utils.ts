import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDuration, intervalToDuration } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCallDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  if (duration.hours) {
    return `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`;
  }
  if (duration.minutes) {
    return `${duration.minutes}m ${duration.seconds}s`;
  }
  return `${duration.seconds}s`;
}

export function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  return phone;
}

// ─── Business timezone helpers ─────────────────────────────────────────────
// All "today" math in this app must go through these helpers so the Overview
// dashboard, analytics RPC, and date-range filters agree on what "today" is.
// Configure via BUSINESS_TZ env var (IANA name); defaults to Asia/Karachi.

export const BUSINESS_TZ = process.env.BUSINESS_TZ ?? "Asia/Karachi";

const yyyyMmDdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Today's date (YYYY-MM-DD) in the business timezone.
export function getBusinessDateStr(d: Date = new Date()): string {
  return yyyyMmDdFormatter.format(d);
}

// Returns the UTC ISO timestamp for the start of the given business-tz date.
// Uses Intl to compute the offset (handles DST automatically).
export function getBusinessDayStartUTC(dateStr: string): string {
  // Find the timezone offset for that date by inspecting how the tz formats
  // a known UTC instant. We sample noon UTC to avoid DST-transition edges.
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(probe);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const local = Date.UTC(
    Number(get("year")), Number(get("month")) - 1, Number(get("day")),
    Number(get("hour")), Number(get("minute")), Number(get("second"))
  );
  const offsetMs = local - probe.getTime();
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) - offsetMs).toISOString();
}

export function getBusinessDayEndUTC(dateStr: string): string {
  const start = new Date(getBusinessDayStartUTC(dateStr));
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "missed":
      return "bg-red-100 text-red-800";
    case "failed":
      return "bg-gray-100 text-gray-800";
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "lead":
      return "bg-purple-100 text-purple-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

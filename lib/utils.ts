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

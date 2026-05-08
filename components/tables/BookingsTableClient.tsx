"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import type { Booking } from "@/types";

interface BookingsTableClientProps {
  bookings: Booking[];
}

const statusVariant = (status: string) => {
  if (status === "confirmed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  return "warning" as const;
};

export default function BookingsTableClient({ bookings: initialBookings }: BookingsTableClientProps) {
  const [bookings, setBookings] = useState(initialBookings);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const filtered = bookings.filter((b) => {
    const matchesStatus = !filter || b.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.member_name.toLowerCase().includes(q) ||
      b.member_phone.toLowerCase().includes(q) ||
      b.class_name.toLowerCase().includes(q) ||
      (b.member_email ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const exportCSV = () => {
    const headers = ["Member", "Phone", "Email", "Class", "Time", "Status", "Booked At"];
    const rows = filtered.map((b) => [
      b.member_name,
      b.member_phone,
      b.member_email ?? "",
      b.class_name,
      b.class_time ? format(new Date(b.class_time), "yyyy-MM-dd HH:mm") : "",
      b.status,
      format(new Date(b.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cancelBooking = async (id: string) => {
    setCancelling(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: "cancelled" as const } : b))
        );
      }
    } finally {
      setCancelling(null);
    }
  };

  const restoreBooking = async (id: string) => {
    setCancelling(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: "confirmed" as const } : b))
        );
      }
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <p className="font-semibold text-gray-900 text-sm shrink-0">
          {filtered.length} bookings
        </p>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
        <input
          type="text"
          placeholder="Search name, phone, class, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-2">
          {["", "confirmed", "pending", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filter === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Booked At</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No bookings found
                </td>
              </tr>
            )}
            {filtered.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{booking.member_name}</td>
                <td className="px-4 py-3 text-gray-600">{booking.member_phone}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{booking.member_email ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700 font-medium">{booking.class_name}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {booking.class_time ? format(new Date(booking.class_time), "MMM d, h:mm a") : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(booking.status)}>{booking.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {format(new Date(booking.created_at), "MMM d, h:mm a")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {booking.status !== "cancelled" && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        disabled={cancelling === booking.id}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 font-medium whitespace-nowrap"
                      >
                        {cancelling === booking.id ? "..." : "Cancel"}
                      </button>
                    )}
                    {booking.status === "cancelled" && (
                      <button
                        onClick={() => restoreBooking(booking.id)}
                        disabled={cancelling === booking.id}
                        className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50 font-medium whitespace-nowrap"
                      >
                        {cancelling === booking.id ? "..." : "Restore"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

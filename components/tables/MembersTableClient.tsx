"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Member } from "@/types";

interface MembersTableClientProps {
  members: Member[];
}

const statusVariant = (status: string) => {
  if (status === "active") return "success" as const;
  if (status === "inactive") return "default" as const;
  return "info" as const;
};

export default function MembersTableClient({ members }: MembersTableClientProps) {
  const [filter, setFilter] = useState<string>("");

  const filtered = members.filter((m) => {
    if (!filter) return true;
    return m.status === filter;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <p className="font-semibold text-gray-900 text-sm">
          {filtered.length} members/leads
        </p>
        <div className="flex gap-2">
          {["", "lead", "active", "inactive"].map((s) => (
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No members found
                </td>
              </tr>
            )}
            {filtered.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{member.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{member.phone ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{member.interest ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(member.status)}>{member.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{member.notes ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {format(new Date(member.created_at), "MMM d, h:mm a")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

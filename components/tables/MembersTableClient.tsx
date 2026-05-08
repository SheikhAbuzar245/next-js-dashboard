"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import type { Member } from "@/types";

interface MembersTableClientProps {
  members: Member[];
}

const statusVariant = (status: string) => {
  if (status === "active") return "success" as const;
  if (status === "inactive") return "default" as const;
  return "info" as const;
};

export default function MembersTableClient({ members: initialMembers }: MembersTableClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered = members.filter((m) => {
    const matchesStatus = !filter || m.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (m.name ?? "").toLowerCase().includes(q) ||
      (m.phone ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Email", "Interest", "Status", "Notes", "Date"];
    const rows = filtered.map((m) => [
      m.name ?? "",
      m.phone ?? "",
      m.email ?? "",
      m.interest ?? "",
      m.status,
      m.notes ?? "",
      format(new Date(m.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateStatus = async (id: string, status: Member["status"]) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status } : m))
        );
      }
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <p className="font-semibold text-gray-900 text-sm shrink-0">
          {filtered.length} members/leads
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
          placeholder="Search name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-2">
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
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No members found
                </td>
              </tr>
            )}
            {filtered.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{member.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{member.phone ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{member.email ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{member.interest ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(member.status)}>{member.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                  {member.notes ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {format(new Date(member.created_at), "MMM d, h:mm a")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {member.status === "lead" && (
                      <button
                        onClick={() => updateStatus(member.id, "active")}
                        disabled={updating === member.id}
                        className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50 whitespace-nowrap font-medium"
                      >
                        {updating === member.id ? "..." : "Activate"}
                      </button>
                    )}
                    {member.status === "active" && (
                      <button
                        onClick={() => updateStatus(member.id, "inactive")}
                        disabled={updating === member.id}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 font-medium"
                      >
                        {updating === member.id ? "..." : "Deactivate"}
                      </button>
                    )}
                    {member.status === "inactive" && (
                      <button
                        onClick={() => updateStatus(member.id, "active")}
                        disabled={updating === member.id}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50 font-medium"
                      >
                        {updating === member.id ? "..." : "Reactivate"}
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

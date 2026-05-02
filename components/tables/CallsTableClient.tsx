"use client";

import { useState } from "react";
import { formatCallDuration, getStatusColor } from "@/lib/utils";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Mic, PhoneMissed, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Call } from "@/types";

interface CallsTableClientProps {
  calls: Call[];
}

const statusVariant = (status: string) => {
  if (status === "completed") return "info";
  if (status === "missed") return "danger";
  if (status === "active") return "success";
  return "default";
};

export default function CallsTableClient({ calls }: CallsTableClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const filtered = calls.filter((c) => {
    if (!filter) return true;
    return c.status === filter;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <p className="font-semibold text-gray-900 text-sm shrink-0">
          {filtered.length} calls
        </p>
        <div className="flex flex-wrap gap-2">
          {["", "completed", "missed", "active", "failed"].map((s) => (
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
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-8" />
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No calls found
                </td>
              </tr>
            )}
            {filtered.map((call) => (
              <>
                <tr
                  key={call.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpandedId(expandedId === call.id ? null : call.id)
                  }
                >
                  <td className="px-4 py-3 text-gray-400">
                    {expandedId === call.id ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {call.caller_phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatCallDuration(call.duration)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(call.status)}>
                      {call.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {call.summary ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {format(new Date(call.created_at), "MMM d, h:mm a")}
                  </td>
                </tr>
                {expandedId === call.id && (
                  <tr key={`${call.id}-expanded`}>
                    <td colSpan={6} className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                      <div className="space-y-3">
                        {call.summary && (
                          <div>
                            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Summary</p>
                            <p className="text-sm text-gray-700">{call.summary}</p>
                          </div>
                        )}
                        {call.transcript && (
                          <div>
                            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Transcript</p>
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white rounded p-3 border border-blue-100 max-h-48 overflow-y-auto">
                              {call.transcript}
                            </pre>
                          </div>
                        )}
                        {call.recording_url && (
                          <div>
                            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Recording</p>
                            <audio controls src={call.recording_url} className="w-full h-8" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { formatCallDuration } from "@/lib/utils";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Mic, Phone, PhoneMissed, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Call, CallMessage } from "@/types";

interface CallsTableClientProps {
  calls: Call[];
}

const statusVariant = (status: string) => {
  if (status === "completed") return "info" as const;
  if (status === "missed") return "danger" as const;
  if (status === "active") return "success" as const;
  return "default" as const;
};

function ChatTranscript({ messages, transcript }: { messages: CallMessage[] | null; transcript: string | null }) {
  if (messages && messages.length > 0) {
    return (
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Mic className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={`rounded-2xl px-4 py-2.5 max-w-sm text-sm leading-relaxed ${
              msg.role === "assistant"
                ? "bg-blue-50 text-blue-900 rounded-tl-sm"
                : "bg-gray-100 text-gray-800 rounded-tr-sm"
            }`}>
              {msg.secondsFromStart !== null && (
                <span className="text-xs opacity-40 block mb-1">
                  {msg.secondsFromStart}s
                </span>
              )}
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center shrink-0 mt-0.5">
                <Phone className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (transcript) {
    return (
      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white rounded-lg p-3 border border-gray-100 max-h-48 overflow-y-auto leading-relaxed">
        {transcript}
      </pre>
    );
  }

  return <p className="text-sm text-gray-400 italic">No transcript available</p>;
}

export default function CallsTableClient({ calls }: CallsTableClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const filtered = calls.filter((c) => (!filter ? true : c.status === filter));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <p className="font-semibold text-gray-900 text-sm shrink-0">{filtered.length} calls</p>
        <div className="flex flex-wrap gap-2">
          {["", "completed", "missed", "active", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-8" />
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Messages</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No calls found
                </td>
              </tr>
            )}
            {filtered.map((call) => {
              const isExpanded = expandedId === call.id;
              const msgCount = call.messages?.length ?? 0;
              return (
                <>
                  <tr
                    key={call.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : call.id)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{call.caller_phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCallDuration(call.duration)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(call.status)}>{call.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {msgCount > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          <Mic className="w-3 h-3" />
                          {msgCount} msgs
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{call.summary ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {format(new Date(call.created_at), "MMM d, h:mm a")}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${call.id}-detail`}>
                      <td colSpan={7} className="bg-gray-50 border-b border-gray-100">
                        <div className="px-6 py-5 space-y-5">

                          {/* Call meta */}
                          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                            {call.started_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Started: {format(new Date(call.started_at), "MMM d yyyy, h:mm a")}
                              </span>
                            )}
                            {call.duration && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                Duration: {formatCallDuration(call.duration)}
                              </span>
                            )}
                            {call.end_reason && (
                              <span>End reason: <span className="font-medium text-gray-700">{call.end_reason}</span></span>
                            )}
                            {call.booking_made && (
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Booking made</span>
                            )}
                            {call.lead_captured && (
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Lead captured</span>
                            )}
                          </div>

                          {/* Summary */}
                          {call.summary && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Summary</p>
                              <p className="text-sm text-gray-700 bg-white rounded-lg px-4 py-3 border border-gray-100">{call.summary}</p>
                            </div>
                          )}

                          {/* Chat transcript */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                              Conversation {msgCount > 0 ? `(${msgCount} messages)` : ""}
                            </p>
                            <ChatTranscript messages={call.messages} transcript={call.transcript} />
                          </div>

                          {/* Audio recording */}
                          {call.recording_url && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recording</p>
                              <audio
                                controls
                                src={call.recording_url}
                                className="w-full h-10 rounded-lg"
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

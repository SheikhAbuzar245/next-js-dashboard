"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Mic, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCallDuration } from "@/lib/utils";
import Link from "next/link";
import type { Call, CallMessage } from "@/types";

interface Props {
  calls: Call[];
}

const statusVariant = (status: string) => {
  if (status === "completed") return "info" as const;
  if (status === "missed") return "danger" as const;
  if (status === "active") return "success" as const;
  return "default" as const;
};

function Transcript({ messages, transcript }: { messages: CallMessage[] | null; transcript: string | null }) {
  if (messages && messages.length > 0) {
    return (
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
            {msg.role === "assistant" && (
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Mic className="w-2.5 h-2.5 text-white" />
              </div>
            )}
            <div className={`rounded-2xl px-3 py-2 max-w-xs text-xs leading-relaxed ${
              msg.role === "assistant"
                ? "bg-blue-50 text-blue-900 rounded-tl-sm"
                : "bg-gray-100 text-gray-800 rounded-tr-sm"
            }`}>
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center shrink-0 mt-0.5">
                <Phone className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (transcript) {
    return (
      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto leading-relaxed">
        {transcript}
      </pre>
    );
  }
  return <p className="text-xs text-gray-400 italic">No transcript available</p>;
}

export default function RecentCallsCard({ calls }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Recent Calls</h3>
        <Link href="/calls" className="text-xs text-blue-600 hover:underline font-medium">
          View all
        </Link>
      </div>

      {calls.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No calls yet</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {calls.map((call) => {
            const isExpanded = expandedId === call.id;
            return (
              <div key={call.id}>
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : call.id)}
                >
                  <span className="text-gray-400">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                  <span className="font-medium text-sm text-gray-900 w-32 shrink-0 truncate">
                    {call.caller_phone ?? "Unknown"}
                  </span>
                  <Badge variant={statusVariant(call.status)}>{call.status}</Badge>
                  <span className="text-xs text-gray-500 ml-1">{formatCallDuration(call.duration)}</span>
                  <span className="text-xs text-gray-400 truncate flex-1 hidden sm:block">
                    {call.summary ?? "—"}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {call.booking_made && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Booked</span>
                    )}
                    {call.lead_captured && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Lead</span>
                    )}
                    <span className="text-xs text-gray-400 hidden md:block whitespace-nowrap">
                      {format(new Date(call.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="bg-gray-50 px-8 py-4 space-y-4 border-t border-gray-100">
                    {call.recording_url && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recording</p>
                        <audio controls src={call.recording_url} className="w-full h-9 rounded-lg" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Transcript {call.messages?.length ? `(${call.messages.length} messages)` : ""}
                      </p>
                      <Transcript messages={call.messages} transcript={call.transcript} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

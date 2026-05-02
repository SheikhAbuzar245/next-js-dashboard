"use client";

import { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { Phone, PhoneOff, Mic, MicOff, Loader2, CheckCircle } from "lucide-react";

type CallStatus = "idle" | "connecting" | "active" | "ending" | "saved";

interface TranscriptLine {
  role: string;
  text: string;
}

interface CallMessage {
  role: "assistant" | "user" | "system" | "tool_call" | "tool_result";
  message?: string;
  content?: string;
  time?: number;
  endTime?: number;
  secondsFromStart?: number;
}

interface EndOfCallReport {
  type: "end-of-call-report";
  endedReason?: string;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  messages?: CallMessage[];
}

function vapiErrorToString(e: unknown): string {
  if (!e) return "Unknown call error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    for (const key of ["message", "msg", "error", "description"]) {
      const v = o[key];
      if (typeof v === "string" && v) return v;
      if (v && typeof v === "object") {
        const inner = v as Record<string, unknown>;
        if (typeof inner.message === "string") return inner.message;
      }
    }
    try { return JSON.stringify(e); } catch { return "Call error"; }
  }
  return String(e);
}

export default function CallAgentButton() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const vapiRef = useRef<Vapi | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const callSavedRef = useRef(false);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  async function saveCallReport(report: Partial<EndOfCallReport>) {
    if (callSavedRef.current) return; // prevent double-save
    callSavedRef.current = true;

    const duration =
      report.durationSeconds ??
      Math.round((Date.now() - startTimeRef.current) / 1000);

    const transcriptText =
      report.transcript ??
      report.messages?.map((m) => `${m.role}: ${m.content}`).join("\n") ??
      transcript.map((t) => `${t.role}: ${t.text}`).join("\n") ??
      null;

    // Normalize messages — Vapi uses `message` field, not `content`
    const normalizedMessages = report.messages
      ?.filter((m) => m.role === "assistant" || m.role === "user")
      .map((m) => ({
        role: m.role,
        content: m.message ?? m.content ?? "",
        secondsFromStart: m.secondsFromStart ?? null,
      }));

    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callerPhone: "web-call",
        status: "completed",
        duration,
        transcript: transcriptText || null,
        messages: normalizedMessages?.length ? normalizedMessages : null,
        summary: report.summary ?? null,
        recordingUrl: report.recordingUrl ?? null,
        endReason: report.endedReason ?? null,
        startedAt: new Date(startTimeRef.current).toISOString(),
        endedAt: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[save-call] failed:", err);
    }
  }

  async function startCall() {
    setError(null);
    setStatus("connecting");
    setTranscript([]);

    try {
      const res = await fetch("/api/vapi-setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Setup failed");

      const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        startTimeRef.current = Date.now();
        callSavedRef.current = false;
        setStatus("active");
      });

      vapi.on("call-end", () => {
        // Fallback: save with whatever transcript we collected if end-of-call-report didn't fire
        saveCallReport({});
        setStatus("saved");
        vapiRef.current = null;
        setTimeout(() => setStatus("idle"), 2500);
      });

      vapi.on("error", (e: unknown) => {
        console.error("[vapi error]", e);
        setError(vapiErrorToString(e));
        setStatus("idle");
        vapiRef.current = null;
      });

      vapi.on("message", (msg: Record<string, unknown>) => {
        // Live transcript lines
        if (
          msg.type === "transcript" &&
          msg.transcriptType === "final" &&
          msg.role &&
          msg.transcript
        ) {
          setTranscript((prev) => [
            ...prev,
            { role: msg.role as string, text: msg.transcript as string },
          ]);
        }

        // End-of-call report — save full call data to Supabase
        if (msg.type === "end-of-call-report") {
          saveCallReport(msg as unknown as EndOfCallReport);
        }
      });

      vapi.on("volume-level", (v: number) => setVolume(v));

      await vapi.start(data.assistantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
      setStatus("idle");
    }
  }

  function endCall() {
    setStatus("ending");
    vapiRef.current?.stop();
  }

  function toggleMute() {
    if (!vapiRef.current) return;
    const next = !isMuted;
    vapiRef.current.setMuted(next);
    setIsMuted(next);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Talk to Sara</h3>
          <p className="text-xs text-gray-500 mt-0.5">AI receptionist — PowerFit Gym</p>
        </div>
        <StatusDot status={status} volume={volume} />
      </div>

      {/* Live transcript */}
      {transcript.length > 0 && (
        <div className="px-5 py-3 max-h-52 overflow-y-auto space-y-2 bg-gray-50 border-b border-gray-100">
          {transcript.map((t, i) => (
            <div
              key={i}
              className={`flex gap-2 text-sm ${
                t.role === "assistant" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`rounded-lg px-3 py-1.5 max-w-xs text-sm ${
                  t.role === "assistant"
                    ? "bg-blue-100 text-blue-900"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                <span className="font-semibold text-xs opacity-60 block mb-0.5">
                  {t.role === "assistant" ? "Sara" : "You"}
                </span>
                {t.text}
              </div>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* Saved confirmation */}
      {status === "saved" && (
        <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="w-4 h-4" />
          Call saved — dashboard updating…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="p-5 flex items-center gap-3">
        {status === "idle" || status === "saved" ? (
          <button
            onClick={startCall}
            disabled={status === "saved"}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Phone className="w-5 h-5" />
            Start Call
          </button>
        ) : status === "ending" ? (
          <button disabled className="flex-1 flex items-center justify-center gap-2 bg-gray-400 text-white font-medium py-3 rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin" />
            Ending…
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className={`p-3 rounded-xl border transition-colors ${
                isMuted
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={endCall}
              disabled={status === "connecting"}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {status === "connecting" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PhoneOff className="w-5 h-5" />
              )}
              {status === "connecting" ? "Connecting…" : "End Call"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status, volume }: { status: CallStatus; volume: number }) {
  if (status === "idle" || status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        Offline
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-yellow-600">
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting
      </span>
    );
  }
  if (status === "ending") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Ending
      </span>
    );
  }
  const size = 8 + Math.round(volume * 8);
  return (
    <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
      <span
        className="rounded-full bg-green-500 transition-all duration-75"
        style={{ width: size, height: size }}
      />
      Live
    </span>
  );
}

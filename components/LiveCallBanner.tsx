"use client";

export default function LiveCallBanner() {
  return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-3">
      <span className="w-3 h-3 bg-green-500 rounded-full live-pulse" />
      <p className="text-green-800 font-medium text-sm">
        Live call in progress — AI agent is active
      </p>
    </div>
  );
}

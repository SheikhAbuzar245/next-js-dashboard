import { createServiceClient } from "@/lib/supabase";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/cards/StatCard";
import CostBreakdownChart from "@/components/charts/CostBreakdownChart";
import { DollarSign, Phone, Clock, TrendingDown } from "lucide-react";
import { formatCallDuration } from "@/lib/utils";

async function getBillingData() {
  const db = createServiceClient();

  const { data: calls } = await db
    .from("calls")
    .select("cost, cost_breakdown, twilio_cost, created_at, duration, status")
    .not("cost", "is", null)
    .order("created_at", { ascending: false });

  const allCalls = calls ?? [];

  // Totals (Vapi cost + real Twilio cost)
  const totalCost = allCalls.reduce((s, c) => s + (c.cost ?? 0) + (c.twilio_cost ?? 0), 0);
  const totalCalls = allCalls.length;
  const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
  const totalDurationSec = allCalls.reduce((s, c) => s + (c.duration ?? 0), 0);
  const costPerMinute = totalDurationSec > 0 ? totalCost / (totalDurationSec / 60) : 0;

  // This week
  const sevenDaysAgo = subDays(new Date(), 6);
  const weekCalls = allCalls.filter((c) => new Date(c.created_at) >= sevenDaysAgo);
  const costThisWeek = weekCalls.reduce((s, c) => s + (c.cost ?? 0) + (c.twilio_cost ?? 0), 0);

  // This month (last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 29);
  const monthCalls = allCalls.filter((c) => new Date(c.created_at) >= thirtyDaysAgo);
  const costThisMonth = monthCalls.reduce((s, c) => s + (c.cost ?? 0) + (c.twilio_cost ?? 0), 0);

  // Provider breakdown totals
  type ACB = { summary?: number; structuredData?: number; successEvaluation?: number };
  type CB = { stt?: number; llm?: number; tts?: number; vapi?: number; transport?: number; total?: number; analysisCostBreakdown?: ACB };
  const getAnalysis = (b: CB) => {
    const a = b.analysisCostBreakdown ?? {};
    return (a.summary ?? 0) + (a.structuredData ?? 0) + (a.successEvaluation ?? 0);
  };
  const providerTotals = allCalls.reduce(
    (acc, c) => {
      const b = (c.cost_breakdown ?? {}) as CB;
      acc.twilio   += c.twilio_cost ?? 0;
      acc.stt      += b.stt        ?? 0;
      acc.llm      += b.llm        ?? 0;
      acc.tts      += b.tts        ?? 0;
      acc.vapi     += b.vapi       ?? 0;
      acc.analysis += getAnalysis(b);
      return acc;
    },
    { twilio: 0, stt: 0, llm: 0, tts: 0, vapi: 0, analysis: 0 }
  );

  // Daily cost breakdown (last 30 days)
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    const dayStr = format(d, "yyyy-MM-dd");
    const dayCalls = allCalls.filter((c) => c.created_at.startsWith(dayStr));
    const b = (c: { cost_breakdown: unknown }) => (c.cost_breakdown ?? {}) as CB;
    return {
      day:      i % 5 === 0 ? format(d, "MMM d") : "",
      twilio:   dayCalls.reduce((s, c) => s + ((c as { twilio_cost?: number }).twilio_cost ?? 0), 0),
      stt:      dayCalls.reduce((s, c) => s + (b(c).stt      ?? 0), 0),
      llm:      dayCalls.reduce((s, c) => s + (b(c).llm      ?? 0), 0),
      tts:      dayCalls.reduce((s, c) => s + (b(c).tts      ?? 0), 0),
      vapi:     dayCalls.reduce((s, c) => s + (b(c).vapi     ?? 0), 0),
      analysis: dayCalls.reduce((s, c) => s + getAnalysis(b(c)), 0),
    };
  });

  // Per-call breakdown table (last 20 calls)
  const recentCalls = allCalls.slice(0, 20);

  return {
    totalCost,
    totalCalls,
    avgCostPerCall,
    costPerMinute,
    costThisWeek,
    costThisMonth,
    totalDurationSec,
    providerTotals,
    dailyData,
    recentCalls,
  };
}

const pct = (part: number, total: number) =>
  total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";

export default async function BillingPage() {
  const data = await getBillingData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-500 text-sm mt-1">AI call costs powered by Vapi</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Spend (All Time)"
          value={`$${data.totalCost.toFixed(4)}`}
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <StatCard
          title="This Month (30d)"
          value={`$${data.costThisMonth.toFixed(4)}`}
          icon={DollarSign}
          iconColor="text-blue-600"
        />
        <StatCard
          title="Avg Cost / Call"
          value={`$${data.avgCostPerCall.toFixed(4)}`}
          icon={Phone}
          iconColor="text-purple-600"
        />
        <StatCard
          title="Avg Cost / Min"
          value={`$${data.costPerMinute.toFixed(4)}`}
          icon={Clock}
          iconColor="text-orange-600"
        />
      </div>

      {/* Provider breakdown + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Provider totals */}
        <Card>
          <CardHeader>
            <CardTitle>Spend by Provider</CardTitle>
            <p className="text-xs text-gray-500 mt-1">All-time totals</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Vapi Platform", key: "vapi", color: "bg-indigo-500" },
              { label: "TTS — ElevenLabs", key: "tts", color: "bg-emerald-500" },
              { label: "LLM — OpenAI", key: "llm", color: "bg-blue-500" },
              { label: "Analysis (AI)", key: "analysis", color: "bg-pink-500" },
              { label: "STT — Deepgram", key: "stt", color: "bg-amber-500" },
              { label: "Telephony — Twilio", key: "twilio", color: "bg-red-500" },
            ].map(({ label, key, color }) => {
              const val = data.providerTotals[key as keyof typeof data.providerTotals];
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-900">
                      ${val.toFixed(4)}{" "}
                      <span className="text-gray-400 font-normal text-xs">
                        ({pct(val, data.totalCost)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`${color} h-1.5 rounded-full`}
                      style={{ width: `${pct(val, data.totalCost)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>${data.totalCost.toFixed(4)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Daily cost chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Cost Breakdown (Last 30 Days)</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Stacked by provider — Twilio · STT · LLM · TTS · Analysis · Vapi platform
            </p>
          </CardHeader>
          <CardContent>
            <CostBreakdownChart data={data.dailyData} />
          </CardContent>
        </Card>
      </div>

      {/* Per-call table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Call Costs</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Last 20 calls with cost data</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Twilio</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">LLM</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">TTS</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Analysis</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vapi</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentCalls.map((c, i) => {
                  type ACB2 = { summary?: number; structuredData?: number; successEvaluation?: number };
                  type CB = { stt?: number; llm?: number; tts?: number; vapi?: number; analysisCostBreakdown?: ACB2 };
                  const b = (c.cost_breakdown ?? {}) as CB;
                  const a = b.analysisCostBreakdown ?? {};
                  const analysis = (a.summary ?? 0) + (a.structuredData ?? 0) + (a.successEvaluation ?? 0);
                  const twilioCost = (c as { twilio_cost?: number }).twilio_cost ?? 0;
                  const rowTotal = (c.cost ?? 0) + twilioCost;
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {format(new Date(c.created_at), "MMM d, h:mm a")}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {c.duration ? formatCallDuration(c.duration) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">${twilioCost.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">${(b.stt ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">${(b.llm ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">${(b.tts ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">${analysis.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">${(b.vapi ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs">${rowTotal.toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

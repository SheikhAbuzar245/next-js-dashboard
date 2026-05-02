import { createServiceClient } from "@/lib/supabase";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MembersTableClient from "@/components/tables/MembersTableClient";
import LeadsFunnelChart from "@/components/charts/LeadsFunnelChart";
import type { Member } from "@/types";

async function getMembersData() {
  const db = createServiceClient();

  const [
    { data: members, count: totalMembers },
    { count: totalCalls },
    { count: totalLeads },
    { count: totalBookings },
  ] = await Promise.all([
    db.from("members").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    db.from("calls").select("id", { count: "exact", head: true }),
    db.from("members").select("id", { count: "exact", head: true }).eq("status", "lead"),
    db.from("bookings").select("id", { count: "exact", head: true }),
  ]);

  const activeMembers = members?.filter((m) => m.status === "active").length ?? 0;

  const funnelData = [
    { stage: "Calls", value: totalCalls ?? 0 },
    { stage: "Leads", value: totalLeads ?? 0 },
    { stage: "Bookings", value: totalBookings ?? 0 },
    { stage: "Members", value: activeMembers },
  ];

  return { members: members ?? [], funnelData };
}

export default async function MembersPage() {
  const { members, funnelData } = await getMembersData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Members & Leads</h1>
        <p className="text-gray-500 text-sm mt-1">
          All leads and members captured by the AI agent
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadsFunnelChart data={funnelData} />
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-4 content-start">
          {[
            { label: "Total Members", value: members.length, color: "text-blue-600 bg-blue-50" },
            { label: "Active Leads", value: members.filter((m) => m.status === "lead").length, color: "text-purple-600 bg-purple-50" },
            { label: "Active Members", value: members.filter((m) => m.status === "active").length, color: "text-green-600 bg-green-50" },
            { label: "Inactive", value: members.filter((m) => m.status === "inactive").length, color: "text-gray-600 bg-gray-50" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl p-5 ${color.split(" ")[1]}`}>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className={`text-sm font-medium mt-1 ${color.split(" ")[0]}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <MembersTableClient members={members} />
    </div>
  );
}

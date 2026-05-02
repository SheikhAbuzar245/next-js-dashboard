"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Phone, Bot, Calendar } from "lucide-react";

const DEFAULT_SYSTEM_PROMPT = `You are Sara, the AI receptionist for PowerFit Gym.
Your job is to:
- Help members book fitness classes
- Answer questions about gym timings, pricing, and classes
- Capture details of new leads interested in membership
- Be friendly, natural, and concise

Always collect the caller's name and phone number.
When booking a class, confirm class name, date, and time.`;

const GYM_CLASSES = [
  { name: "Yoga", time: "6:00 AM", days: "Mon, Wed, Fri" },
  { name: "CrossFit", time: "7:00 AM", days: "Tue, Thu, Sat" },
  { name: "Spinning", time: "8:00 AM", days: "Mon, Wed, Fri" },
  { name: "Boxing", time: "6:00 PM", days: "Mon, Tue, Thu" },
  { name: "Pilates", time: "7:00 PM", days: "Wed, Fri" },
  { name: "HIIT", time: "5:30 AM", days: "Daily" },
];

export default function SettingsPage() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [phoneNumber, setPhoneNumber] = useState("+1 (555) 000-0000");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your AI agent and gym settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <CardTitle>AI Agent System Prompt</CardTitle>
          </div>
          <CardDescription>
            This defines Sara&apos;s personality and instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full h-48 text-sm border border-gray-200 rounded-lg p-3 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">{systemPrompt.length} characters</p>
            <Button onClick={handleSave} size="sm">
              <Save className="w-4 h-4" />
              {saved ? "Saved!" : "Save Prompt"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-600" />
            <CardTitle>Phone Number</CardTitle>
          </div>
          <CardDescription>AI agent phone number via Vapi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              type="tel"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <Button variant="outline" size="sm">Update</Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Set your webhook URL in Vapi dashboard:{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              https://yourdomain.com/api/vapi-webhook
            </code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <CardTitle>Class Schedule</CardTitle>
          </div>
          <CardDescription>Classes available for AI to book</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {GYM_CLASSES.map((cls) => (
              <div
                key={cls.name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{cls.name}</p>
                  <p className="text-xs text-gray-500">{cls.days}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{cls.time}</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full">
            + Add Class
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vapi Tools Configuration</CardTitle>
          <CardDescription>Function tools the AI can call during conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: "bookClass", desc: "Books a fitness class for a member", params: "memberName, memberPhone, className, classTime" },
              { name: "checkAvailability", desc: "Checks if a class has available spots", params: "className, date" },
              { name: "saveLead", desc: "Saves a new lead to the database", params: "name, phone, interest, notes" },
              { name: "getMemberInfo", desc: "Looks up an existing member", params: "phone" },
            ].map((tool) => (
              <div key={tool.name} className="p-3 border border-gray-100 rounded-lg">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-semibold text-blue-700">{tool.name}()</code>
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                </div>
                <p className="text-xs text-gray-500 mt-1">{tool.desc}</p>
                <p className="text-xs text-gray-400 mt-0.5">Params: {tool.params}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

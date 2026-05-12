"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Phone, Bot, Calendar, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

const GYM_CLASSES = [
  { name: "Yoga", time: "6:00 AM", days: "Monday, Wednesday, Friday" },
  { name: "CrossFit", time: "7:00 AM", days: "Tuesday, Thursday, Saturday" },
  { name: "Spinning", time: "8:00 AM", days: "Monday, Wednesday, Friday" },
  { name: "Boxing", time: "6:00 PM", days: "Monday, Tuesday, Thursday" },
  { name: "Pilates", time: "7:00 PM", days: "Wednesday, Friday" },
  { name: "HIIT", time: "5:30 AM", days: "Daily" },
];

type TwilioStatus = {
  connected: boolean;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  assistantId: string | null;
};

export default function SettingsPage() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/assistant-settings")
      .then((r) => r.json())
      .then((d) => { if (d.systemPrompt) setSystemPrompt(d.systemPrompt); })
      .catch(() => {})
      .finally(() => setPromptLoading(false));
  }, []);

  // Twilio state
  const [twilioStatus, setTwilioStatus] = useState<TwilioStatus | null>(null);
  const [twilioLoading, setTwilioLoading] = useState(true);
  const [twilioError, setTwilioError] = useState<string | null>(null);
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchTwilioStatus = useCallback(async () => {
    setTwilioLoading(true);
    setTwilioError(null);
    try {
      const res = await fetch("/api/twilio-setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load Twilio status");
      setTwilioStatus(data);
    } catch (e) {
      setTwilioError(e instanceof Error ? e.message : String(e));
    } finally {
      setTwilioLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTwilioStatus();
  }, [fetchTwilioStatus]);

  const handleConnect = async () => {
    if (!accountSid || !authToken || !phoneNumber) {
      setTwilioError("All three fields are required.");
      return;
    }
    setTwilioSaving(true);
    setTwilioError(null);
    try {
      const res = await fetch("/api/twilio-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twilioAccountSid: accountSid, twilioAuthToken: authToken, phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect Twilio number");
      setTwilioStatus({ connected: true, phoneNumber: data.phoneNumber, phoneNumberId: data.phoneNumberId, assistantId: data.assistantId });
      setShowForm(false);
      setAccountSid("");
      setAuthToken("");
      setPhoneNumber("");
    } catch (e) {
      setTwilioError(e instanceof Error ? e.message : String(e));
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleSyncAssistant = async () => {
    setTwilioSaving(true);
    setTwilioError(null);
    try {
      const res = await fetch("/api/twilio-setup", { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to sync assistant");
      setTwilioStatus((prev) => prev ? { ...prev, assistantId: data.assistantId } : prev);
    } catch (e) {
      setTwilioError(e instanceof Error ? e.message : String(e));
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!twilioStatus?.phoneNumberId) return;
    setTwilioSaving(true);
    setTwilioError(null);
    try {
      const res = await fetch("/api/twilio-setup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId: twilioStatus.phoneNumberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to disconnect");
      setTwilioStatus({ connected: false, phoneNumber: null, phoneNumberId: null, assistantId: null });
    } catch (e) {
      setTwilioError(e instanceof Error ? e.message : String(e));
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/assistant-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Failed to save prompt. Try again.");
    } finally {
      setSaving(false);
    }
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
          {promptLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading current prompt...
            </div>
          ) : (
            <>
              <textarea
                className="w-full h-64 text-sm border border-gray-200 rounded-lg p-3 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={systemPrompt}
                onChange={(e) => { setSystemPrompt(e.target.value); setSaveError(null); }}
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-400">{systemPrompt.length} characters</p>
                <Button onClick={handleSave} size="sm" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : saved ? "Saved!" : "Save Prompt"}
                </Button>
              </div>
              {saveError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {saveError}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Twilio Phone Number */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-600" />
              <CardTitle>Twilio Phone Number</CardTitle>
            </div>
            {!twilioLoading && twilioStatus && (
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                twilioStatus.connected
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {twilioStatus.connected
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Connected</>
                  : <><XCircle className="w-3.5 h-3.5" /> Not connected</>
                }
              </span>
            )}
          </div>
          <CardDescription>
            Link a Twilio phone number so callers can dial in and talk to Sara
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {twilioLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading status...
            </div>
          ) : twilioStatus?.connected ? (
            <div className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-lg border ${twilioStatus.assistantId ? "bg-green-50 border-green-100" : "bg-yellow-50 border-yellow-200"}`}>
                <div>
                  <p className={`text-sm font-semibold ${twilioStatus.assistantId ? "text-green-800" : "text-yellow-800"}`}>{twilioStatus.phoneNumber}</p>
                  <p className={`text-xs mt-0.5 ${twilioStatus.assistantId ? "text-green-600" : "text-yellow-700"}`}>
                    {twilioStatus.assistantId ? "Routed to Sara — AI assistant active" : "Number connected but assistant not linked"}
                  </p>
                </div>
                {twilioStatus.assistantId
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <AlertCircle className="w-5 h-5 text-yellow-500" />
                }
              </div>

              {!twilioStatus.assistantId && (
                <Button size="sm" onClick={handleSyncAssistant} disabled={twilioSaving}>
                  {twilioSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {twilioSaving ? "Linking..." : "Link Assistant to Number"}
                </Button>
              )}

              <p className="text-xs text-gray-400">
                Incoming calls to this number are answered by Sara. Call logs appear in the{" "}
                <span className="font-medium text-gray-600">Calls</span> tab automatically.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={twilioSaving}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {twilioSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Disconnect Number
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {!showForm ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    No Twilio number connected. Link one to enable inbound phone calls.
                  </p>
                  <Button size="sm" onClick={() => setShowForm(true)}>
                    <Phone className="w-4 h-4" />
                    Connect Twilio Number
                  </Button>
                  <div className="text-xs text-gray-400 space-y-1 pt-1">
                    <p className="font-medium text-gray-500">How to get your credentials:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Go to <span className="font-mono bg-gray-100 px-1 rounded">console.twilio.com</span></li>
                      <li>Copy your Account SID and Auth Token from the dashboard</li>
                      <li>Buy a phone number under <span className="font-mono bg-gray-100 px-1 rounded">Phone Numbers → Manage → Buy</span></li>
                      <li>Enter the number in E.164 format (e.g. <span className="font-mono bg-gray-100 px-1 rounded">+12025550100</span>)</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Account SID</label>
                    <input
                      type="text"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={accountSid}
                      onChange={(e) => setAccountSid(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Auth Token</label>
                    <input
                      type="password"
                      placeholder="Your Twilio auth token"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Phone Number (E.164)</label>
                    <input
                      type="tel"
                      placeholder="+12025550100"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConnect} disabled={twilioSaving}>
                      {twilioSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {twilioSaving ? "Connecting..." : "Connect"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setTwilioError(null); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {twilioError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {twilioError}
            </div>
          )}
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
          <p className="text-xs text-gray-400 mt-3">To add or change classes, update the system prompt above.</p>
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
              { name: "bookClass", desc: "Books a fitness class for a member", params: "memberName, memberPhone, memberEmail, className, classTime" },
              { name: "saveLead", desc: "Saves a new lead to the database", params: "name, phone, email, interest, notes" },
              { name: "getMemberInfo", desc: "Looks up an existing member by phone number", params: "phone" },
              { name: "checkAvailability", desc: "Returns active classes and schedules from the database", params: "className (optional)" },
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

export interface Call {
  id: string;
  vapi_call_id: string | null;
  caller_phone: string | null;
  status: "active" | "completed" | "missed" | "failed";
  duration: number | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  booking_made: boolean;
  lead_captured: boolean;
  end_reason: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  call_id: string | null;
  member_name: string;
  member_phone: string;
  class_name: string;
  class_time: string;
  status: "confirmed" | "cancelled" | "pending";
  notes: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  call_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  interest: string | null;
  status: "lead" | "active" | "inactive";
  notes: string | null;
  source: string;
  created_at: string;
}

export interface GymClass {
  id: string;
  name: string;
  instructor: string | null;
  schedule: { day: string; time: string } | null;
  capacity: number;
  is_active: boolean;
  created_at: string;
}

export interface AnalyticsRow {
  id: string;
  date: string;
  total_calls: number;
  completed_calls: number;
  missed_calls: number;
  bookings_made: number;
  leads_captured: number;
  avg_call_duration: number;
  created_at: string;
}

export interface AnalyticsResponse {
  today: {
    totalCalls: number;
    completedCalls: number;
    missedCalls: number;
    bookingsMade: number;
    newLeads: number;
  };
  thisWeek: {
    callsPerDay: number[];
    bookingsPerDay: number[];
    topClass: string;
    peakHour: string;
  };
  aiPerformance: {
    resolutionRate: string;
    avgCallDuration: string;
    bookingSuccessRate: string;
  };
}

export interface VapiCallStartedPayload {
  event: "call.started";
  call: {
    id: string;
    phoneNumber: string;
    startedAt: string;
  };
}

export interface VapiCallEndedPayload {
  event: "call.ended";
  call: {
    id: string;
    phoneNumber: string;
    startedAt: string;
    endedAt: string;
    duration: number;
    transcript: string;
    summary: string;
    recordingUrl: string;
    endReason: string;
  };
}

export interface VapiToolCalledPayload {
  event: "tool.called";
  tool: {
    name: string;
    parameters: Record<string, string>;
  };
  callId: string;
}

export interface VapiCallMissedPayload {
  event: "call.missed";
  call: {
    id: string;
    phoneNumber: string;
    missedAt: string;
  };
}

export type VapiWebhookPayload =
  | VapiCallStartedPayload
  | VapiCallEndedPayload
  | VapiToolCalledPayload
  | VapiCallMissedPayload;

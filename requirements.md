# Gym AI Voice Dashboard — Technical Requirements

## Project Overview

A next-generation gym management platform powered by AI voice agents. The system automates inbound calls, class bookings, lead capture, and member motivation — with a real-time dashboard for gym owners to monitor everything.

---

## 1. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Voice AI | Vapi | AI voice agent platform |
| AI Brain | GPT-4o | Understands and responds to member conversations |
| Voice | ElevenLabs | Human-like voice for the AI agent |
| Frontend | Next.js 14 (App Router) | Dashboard UI |
| Backend | Next.js API Routes | Webhook handlers and data endpoints |
| Database | Supabase (PostgreSQL) | Stores all calls, bookings, members |
| Real-time | Supabase Realtime | Live dashboard updates |
| Styling | Tailwind CSS | Fast UI styling |
| Components | Shadcn/UI | Ready-made dashboard components |
| Charts | Recharts | Analytics and data visualization |
| Deployment | Vercel | Hosting frontend + backend |
| Language | TypeScript | Type-safe codebase |

---

## 2. Project Folder Structure

```
gym-ai-dashboard/
├── app/
│   ├── page.tsx                    # Overview / Home
│   ├── calls/
│   │   └── page.tsx                # All call logs
│   ├── bookings/
│   │   └── page.tsx                # All AI-made bookings
│   ├── members/
│   │   └── page.tsx                # Leads and members
│   ├── analytics/
│   │   └── page.tsx                # Charts and performance
│   ├── settings/
│   │   └── page.tsx                # Vapi agent configuration
│   └── api/
│       ├── vapi-webhook/
│       │   └── route.ts            # Receives all Vapi events
│       ├── calls/
│       │   └── route.ts            # GET all calls
│       ├── calls/[id]/
│       │   └── route.ts            # GET single call with transcript
│       ├── bookings/
│       │   └── route.ts            # GET / POST bookings
│       ├── members/
│       │   └── route.ts            # GET / POST members
│       └── analytics/
│           └── route.ts            # GET chart data and stats
├── components/
│   ├── ui/                         # Shadcn components
│   ├── charts/                     # Recharts wrappers
│   ├── tables/                     # Data tables
│   └── cards/                      # KPI stat cards
├── lib/
│   ├── supabase.ts                 # Supabase client
│   └── utils.ts                    # Helper functions
└── types/
    └── index.ts                    # TypeScript interfaces
```

---

## 3. Vapi Setup Requirements

### Agent Configuration
- Create a Vapi account at vapi.ai
- Create an assistant with a system prompt defining the receptionist persona
- Attach GPT-4o as the AI model
- Attach ElevenLabs voice
- Purchase or connect a phone number

### System Prompt (Example)
```
You are Sara, the AI receptionist for PowerFit Gym.
Your job is to:
- Help members book fitness classes
- Answer questions about gym timings, pricing, and classes
- Capture details of new leads interested in membership
- Be friendly, natural, and concise

Always collect the caller's name and phone number.
When booking a class, confirm class name, date, and time.
```

### Vapi Tools (Function Calling)
Define these tools in Vapi so the AI can take actions:

| Tool Name | Parameters | Purpose |
|-----------|-----------|---------|
| `bookClass` | memberName, memberPhone, className, classTime | Book a class |
| `checkAvailability` | className, date | Check if class has spots |
| `saveLead` | name, phone, interest, notes | Save a new lead |
| `getMemberInfo` | phone | Look up existing member |

### Webhook URL
Set this in Vapi dashboard:
```
https://yourdomain.com/api/vapi-webhook
```

---

## 4. Webhooks

All webhooks are received at `POST /api/vapi-webhook`

---

### Webhook 1 — `call.started`
Fired when a call begins.

**Payload:**
```json
{
  "event": "call.started",
  "call": {
    "id": "call_abc123",
    "phoneNumber": "+923001234567",
    "startedAt": "2024-01-15T18:00:00Z"
  }
}
```

**Action:**
- Insert new row in `calls` table
- Set status to `active`
- Dashboard shows live call indicator

---

### Webhook 2 — `call.ended`
Fired when call finishes. Most important webhook.

**Payload:**
```json
{
  "event": "call.ended",
  "call": {
    "id": "call_abc123",
    "phoneNumber": "+923001234567",
    "startedAt": "2024-01-15T18:00:00Z",
    "endedAt": "2024-01-15T18:02:30Z",
    "duration": 150,
    "transcript": "Sara: Hello PowerFit Gym! Member: Hi I want to book yoga...",
    "summary": "Member booked yoga class for tomorrow 6pm",
    "recordingUrl": "https://vapi.ai/recordings/abc123.mp3",
    "endReason": "member_hangup"
  }
}
```

**Action:**
- Update `calls` row with duration, transcript, summary, status = `completed`
- Dashboard updates in real time via Supabase

---

### Webhook 3 — `tool.called`
Fired when AI needs to perform an action mid-call.

**Payload (booking example):**
```json
{
  "event": "tool.called",
  "tool": {
    "name": "bookClass",
    "parameters": {
      "memberName": "Ahmed Khan",
      "memberPhone": "+923001234567",
      "className": "Yoga",
      "classTime": "2024-01-16T18:00:00Z"
    }
  },
  "callId": "call_abc123"
}
```

**Payload (lead example):**
```json
{
  "event": "tool.called",
  "tool": {
    "name": "saveLead",
    "parameters": {
      "name": "Sara Ali",
      "phone": "+923009876543",
      "interest": "Monthly Membership",
      "notes": "Interested in morning slots"
    }
  }
}
```

**Action:**
- Route to correct handler based on `tool.name`
- Save data to appropriate table
- Return success response to Vapi so it can continue the conversation

---

### Webhook 4 — `call.missed`
Fired when call is not answered or drops.

**Payload:**
```json
{
  "event": "call.missed",
  "call": {
    "id": "call_xyz789",
    "phoneNumber": "+923001234567",
    "missedAt": "2024-01-15T20:00:00Z"
  }
}
```

**Action:**
- Insert row in `calls` table with status = `missed`
- Dashboard shows missed call alert

---

## 5. API Endpoints

### `POST /api/vapi-webhook`
Receives all Vapi events and routes them.

```typescript
export async function POST(request: Request) {
  const body = await request.json()
  const { event } = body

  switch (event) {
    case 'call.started':   await handleCallStarted(body.call); break
    case 'call.ended':     await handleCallEnded(body.call); break
    case 'tool.called':    await handleToolCall(body.tool, body.callId); break
    case 'call.missed':    await handleMissedCall(body.call); break
  }

  return Response.json({ success: true })
}
```

---

### `GET /api/calls`
Returns paginated list of all calls.

**Query params:** `?limit=20&page=1&status=completed&date=2024-01-15`

**Response:**
```json
{
  "calls": [
    {
      "id": "call_abc123",
      "callerPhone": "+923001234567",
      "duration": 150,
      "status": "completed",
      "summary": "Member booked yoga class",
      "createdAt": "2024-01-15T18:00:00Z"
    }
  ],
  "total": 24,
  "page": 1
}
```

---

### `GET /api/calls/[id]`
Returns single call with full transcript and recording.

**Response:**
```json
{
  "id": "call_abc123",
  "callerPhone": "+923001234567",
  "duration": 150,
  "transcript": "Full conversation text...",
  "recordingUrl": "https://vapi.ai/recordings/abc123.mp3",
  "bookingMade": true,
  "createdAt": "2024-01-15T18:00:00Z"
}
```

---

### `GET /api/bookings`
Returns all bookings made by AI.

**Query params:** `?status=confirmed&date=2024-01-16`

**Response:**
```json
{
  "bookings": [
    {
      "id": "booking_001",
      "memberName": "Ahmed Khan",
      "memberPhone": "+923001234567",
      "className": "Yoga",
      "classTime": "2024-01-16T18:00:00Z",
      "status": "confirmed",
      "createdAt": "2024-01-15T18:01:00Z"
    }
  ],
  "total": 8
}
```

---

### `POST /api/bookings`
Creates a new booking (called internally by webhook handler).

**Body:**
```json
{
  "memberName": "Ahmed Khan",
  "memberPhone": "+923001234567",
  "className": "Yoga",
  "classTime": "2024-01-16T18:00:00Z",
  "callId": "call_abc123"
}
```

---

### `GET /api/members`
Returns all leads and members.

**Response:**
```json
{
  "members": [
    {
      "id": "member_001",
      "name": "Sara Ali",
      "phone": "+923009876543",
      "interest": "Monthly Membership",
      "status": "lead",
      "notes": "Interested in morning slots",
      "createdAt": "2024-01-15T20:00:00Z"
    }
  ],
  "total": 15
}
```

---

### `GET /api/analytics`
Returns data for all charts and KPI cards.

**Response:**
```json
{
  "today": {
    "totalCalls": 24,
    "completedCalls": 22,
    "missedCalls": 2,
    "bookingsMade": 8,
    "newLeads": 5
  },
  "thisWeek": {
    "callsPerDay": [12, 18, 24, 20, 15, 8, 24],
    "bookingsPerDay": [5, 7, 8, 6, 4, 2, 8],
    "topClass": "Yoga",
    "peakHour": "6pm - 7pm"
  },
  "aiPerformance": {
    "resolutionRate": "92%",
    "avgCallDuration": "1m 45s",
    "bookingSuccessRate": "88%"
  }
}
```

---

## 6. Database Tables (Supabase / PostgreSQL)

### Table: `calls`
Stores every call received by the AI agent.

```sql
CREATE TABLE calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_call_id    TEXT UNIQUE,
  caller_phone    TEXT,
  status          TEXT CHECK (status IN ('active', 'completed', 'missed', 'failed')),
  duration        INT,                    -- seconds
  transcript      TEXT,
  summary         TEXT,
  recording_url   TEXT,
  booking_made    BOOLEAN DEFAULT false,
  lead_captured   BOOLEAN DEFAULT false,
  end_reason      TEXT,
  started_at      TIMESTAMP,
  ended_at        TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);
```

---

### Table: `bookings`
Stores every class booking the AI makes.

```sql
CREATE TABLE bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id       UUID REFERENCES calls(id),
  member_name   TEXT NOT NULL,
  member_phone  TEXT NOT NULL,
  class_name    TEXT NOT NULL,
  class_time    TIMESTAMP NOT NULL,
  status        TEXT CHECK (status IN ('confirmed', 'cancelled', 'pending')) DEFAULT 'confirmed',
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT now()
);
```

---

### Table: `members`
Stores every lead or member captured by AI.

```sql
CREATE TABLE members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     UUID REFERENCES calls(id),
  name        TEXT,
  phone       TEXT UNIQUE,
  email       TEXT,
  interest    TEXT,
  status      TEXT CHECK (status IN ('lead', 'active', 'inactive')) DEFAULT 'lead',
  notes       TEXT,
  source      TEXT DEFAULT 'inbound_call',
  created_at  TIMESTAMP DEFAULT now()
);
```

---

### Table: `classes`
Available gym classes that can be booked.

```sql
CREATE TABLE classes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  instructor   TEXT,
  schedule     JSONB,           -- { day: "Monday", time: "18:00" }
  capacity     INT DEFAULT 20,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT now()
);
```

---

### Table: `analytics`
Daily snapshot for fast chart loading.

```sql
CREATE TABLE analytics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE UNIQUE,
  total_calls         INT DEFAULT 0,
  completed_calls     INT DEFAULT 0,
  missed_calls        INT DEFAULT 0,
  bookings_made       INT DEFAULT 0,
  leads_captured      INT DEFAULT 0,
  avg_call_duration   INT DEFAULT 0,     -- seconds
  created_at          TIMESTAMP DEFAULT now()
);
```

---

### Table Relationships

```
calls
  └── bookings   (call_id → calls.id)
  └── members    (call_id → calls.id)
```

---

## 7. Dashboard Pages & Charts

### Page 1 — Overview (Home)
**Components:**
- KPI Cards: Total Calls, Bookings Today, New Leads, Resolution Rate
- Bar Chart: Calls per day (this week)
- Donut Chart: Call status breakdown (completed / missed / failed)
- Live call indicator (green pulse when call is active)

---

### Page 2 — Calls
**Components:**
- Table: All call logs (phone, duration, status, summary, date)
- Click row → expand full transcript
- Filter by date, status
- Bar Chart: Average call duration per day

---

### Page 3 — Bookings
**Components:**
- Table: All AI bookings (member, class, time, status)
- Line Chart: Bookings trend over 30 days
- Pie Chart: Most booked classes

---

### Page 4 — Members / Leads
**Components:**
- Table: All leads (name, phone, interest, status, date)
- Funnel Chart: Calls → Leads → Bookings → Members
- Status filter: lead / active / inactive

---

### Page 5 — Analytics
**Components:**
- All charts combined in one view
- Heatmap: Peak call hours by day of week
- KPI Cards: AI performance metrics
- Date range picker to filter all charts

---

### Page 6 — Settings
**Components:**
- Vapi agent configuration (system prompt editor)
- Phone number management
- Class schedule management
- Notification preferences

---

## 8. Charts Summary (Recharts)

| Chart | Type | Page | Shows |
|-------|------|------|-------|
| Calls Per Day | Bar Chart | Overview | Daily call volume this week |
| Call Status | Donut Chart | Overview | Completed vs missed vs failed |
| Bookings Trend | Line Chart | Bookings | Bookings over last 30 days |
| Top Classes | Pie Chart | Bookings | Most booked class types |
| Peak Hours | Heatmap | Analytics | Busiest times of day |
| Leads Funnel | Funnel Chart | Members | Conversion through pipeline |
| Call Duration | Bar Chart | Calls | Average duration per day |
| AI Performance | KPI Cards | All pages | Resolution rate, avg duration |

---

## 9. Real-Time Setup (Supabase)

```typescript
// Listen for new calls and update dashboard live
supabase
  .channel('calls')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'calls'
  }, (payload) => {
    // Update call list in real time
    addNewCall(payload.new)
  })
  .subscribe()

// Listen for new bookings
supabase
  .channel('bookings')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'bookings'
  }, (payload) => {
    addNewBooking(payload.new)
  })
  .subscribe()
```

---

## 10. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Vapi
VAPI_API_KEY=your_vapi_api_key
VAPI_WEBHOOK_SECRET=your_webhook_secret

# OpenAI (if using GPT-4o directly)
OPENAI_API_KEY=your_openai_key
```

---

## 11. Build Order (Recommended)

### Week 1 — Foundation
- Set up Next.js project with TypeScript
- Connect Supabase and create all tables
- Set up environment variables

### Week 2 — Voice + Webhook
- Create Vapi agent with system prompt
- Define tool functions in Vapi
- Build `POST /api/vapi-webhook` handler
- Test: Make a call → verify data saves to Supabase

### Week 3 — Dashboard
- Build all GET API endpoints
- Build Overview page with KPI cards
- Build Calls page with table and transcripts
- Build Bookings page

### Week 4 — Charts + Polish
- Add all Recharts visualizations
- Add Supabase real-time subscriptions
- Build Members and Analytics pages
- Deploy to Vercel

---

## 12. Deployment

| Service | What to Deploy | Free Tier |
|---------|---------------|-----------|
| Vercel | Next.js app (frontend + API routes) | Yes |
| Supabase | PostgreSQL database + real-time | Yes (500MB) |
| Vapi | Voice agent + phone number | Pay per minute |

---

## 13. NPM Packages to Install

```bash
# Core
npm install next react react-dom typescript

# Supabase
npm install @supabase/supabase-js

# UI
npm install tailwindcss shadcn-ui

# Charts
npm install recharts

# Utilities
npm install date-fns clsx
```

---

## Summary

```
Vapi          → AI voice agent answers calls
GPT-4o        → Brain of the AI
Next.js       → Frontend dashboard + API routes
Supabase      → Database + real-time updates
Tailwind/UI   → Fast, clean UI
Recharts      → Charts and analytics
Vercel        → Deployment
```

> Build the webhook first. Once real data flows into Supabase, build the dashboard around it.
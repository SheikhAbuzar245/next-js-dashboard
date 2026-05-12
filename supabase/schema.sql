-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS calls (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_call_id        TEXT UNIQUE,
  caller_phone        TEXT,
  status              TEXT CHECK (status IN ('active', 'completed', 'missed', 'failed')),
  duration            INT,
  transcript          TEXT,
  messages            JSONB,
  summary             TEXT,
  success_evaluation  BOOLEAN,
  structured_data     JSONB,
  recording_url       TEXT,
  booking_made        BOOLEAN DEFAULT false,
  lead_captured       BOOLEAN DEFAULT false,
  end_reason          TEXT,
  cost                FLOAT8,
  cost_breakdown      JSONB,
  twilio_cost         FLOAT8,
  started_at          TIMESTAMP,
  ended_at            TIMESTAMP,
  created_at          TIMESTAMP DEFAULT now()
);

-- Migration: run this if the table already exists
-- ALTER TABLE calls ADD COLUMN IF NOT EXISTS success_evaluation BOOLEAN;
-- ALTER TABLE calls ADD COLUMN IF NOT EXISTS structured_data JSONB;

CREATE TABLE IF NOT EXISTS bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id       UUID REFERENCES calls(id),
  member_name   TEXT NOT NULL,
  member_phone  TEXT NOT NULL,
  member_email  TEXT,
  class_name    TEXT NOT NULL,
  class_time    TIMESTAMP NOT NULL,
  status        TEXT CHECK (status IN ('confirmed', 'cancelled', 'pending')) DEFAULT 'confirmed',
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
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

CREATE TABLE IF NOT EXISTS classes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  instructor   TEXT,
  schedule     JSONB,
  capacity     INT DEFAULT 20,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE UNIQUE,
  total_calls         INT DEFAULT 0,
  completed_calls     INT DEFAULT 0,
  missed_calls        INT DEFAULT 0,
  bookings_made       INT DEFAULT 0,
  leads_captured      INT DEFAULT 0,
  avg_call_duration   INT DEFAULT 0,
  created_at          TIMESTAMP DEFAULT now()
);

-- Enable realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE members;

-- ─── Migrations: run these if tables already exist ───────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS member_email TEXT;
ALTER TABLE calls    ADD COLUMN IF NOT EXISTS messages        JSONB;
ALTER TABLE calls    ADD COLUMN IF NOT EXISTS cost            FLOAT8;
ALTER TABLE calls    ADD COLUMN IF NOT EXISTS cost_breakdown  JSONB;
ALTER TABLE calls    ADD COLUMN IF NOT EXISTS twilio_cost     FLOAT8;

-- Sample classes
INSERT INTO classes (name, instructor, schedule, capacity) VALUES
  ('Yoga', 'Sarah J.', '{"day": "Monday", "time": "06:00"}', 20),
  ('CrossFit', 'Mike R.', '{"day": "Tuesday", "time": "07:00"}', 15),
  ('Spinning', 'Ali K.', '{"day": "Wednesday", "time": "08:00"}', 25),
  ('Boxing', 'Tom B.', '{"day": "Thursday", "time": "18:00"}', 12),
  ('Pilates', 'Emma L.', '{"day": "Friday", "time": "19:00"}', 18),
  ('HIIT', 'Chris M.', '{"day": "Saturday", "time": "05:30"}', 20)
ON CONFLICT DO NOTHING;

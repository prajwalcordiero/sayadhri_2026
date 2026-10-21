-- SwasthaSetu Database Schema for Low-Bandwidth Telemedicine

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('patient', 'asha', 'doctor')),
  phone TEXT,
  specialty TEXT,
  languages TEXT DEFAULT '["Kannada", "English"]',
  available INTEGER DEFAULT 1,
  idle_since INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  created_by_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_age INTEGER NOT NULL,
  patient_sex TEXT NOT NULL,
  patient_village TEXT NOT NULL,
  complaint_category TEXT NOT NULL,
  symptoms TEXT NOT NULL, -- JSON array
  duration TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 5),
  vitals TEXT, -- JSON object
  urgency TEXT NOT NULL CHECK(urgency IN ('Emergency', 'Urgent', 'Routine')),
  suggested_specialty TEXT NOT NULL,
  triage_reasons TEXT NOT NULL, -- JSON array
  assigned_doctor_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in-consultation', 'completed', 'cancelled')),
  consultation_mode TEXT DEFAULT 'video',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES users(id),
  FOREIGN KEY (assigned_doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, -- Client-generated UUID for idempotency
  case_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'audio', 'system', 'advice')),
  attachment_url TEXT,
  attachment_meta TEXT, -- JSON object e.g. { original_size, sent_size }
  created_at INTEGER NOT NULL,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE TABLE IF NOT EXISTS prescriptions_advice (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  diagnosis_note TEXT NOT NULL,
  medicines TEXT NOT NULL, -- JSON array of medicine objects
  follow_up_days INTEGER DEFAULT 7,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS uploads (
  upload_id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  total_chunks INTEGER NOT NULL,
  received_chunks INTEGER NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  is_complete INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications_sms (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered',
  case_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS impact_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  mode TEXT NOT NULL,
  bytes_sent INTEGER DEFAULT 0,
  bytes_received INTEGER DEFAULT 0,
  degradation_events INTEGER DEFAULT 0,
  consultations_completed INTEGER DEFAULT 0,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_doctor ON cases(assigned_doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_urgency ON cases(urgency, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id, created_at);

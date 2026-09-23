CREATE TABLE IF NOT EXISTS course_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES course_sessions(id),
  email TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  session_snapshot TEXT NOT NULL CHECK(json_valid(session_snapshot)),
  consent_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  mode TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, email, mode)
);
CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id),
  kind TEXT NOT NULL CHECK(kind IN ('student','office')),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER,
  next_attempt_at INTEGER NOT NULL,
  lease_until INTEGER,
  lease_token TEXT,
  provider_id TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(registration_id, kind)
);
CREATE INDEX IF NOT EXISTS notification_due ON notification_jobs(status, next_attempt_at);
CREATE TABLE IF NOT EXISTS registration_rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  realm TEXT,
  object_type TEXT,
  object_id TEXT,
  object_label TEXT,
  context TEXT,
  position INTEGER,
  source TEXT NOT NULL DEFAULT 'direct',
  device TEXT NOT NULL CHECK (device IN ('mobile', 'desktop')),
  path TEXT NOT NULL DEFAULT '/',
  country TEXT,
  client_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created
  ON analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
  ON analytics_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON analytics_events(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_rate_limits (
  actor_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL
);

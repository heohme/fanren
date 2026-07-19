PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('creator', 'work', 'correction')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'duplicate', 'needs_info', 'withdrawn')),
  target_url TEXT NOT NULL,
  target_key TEXT NOT NULL,
  up_uid TEXT,
  up_name TEXT,
  title TEXT,
  episode INTEGER,
  category TEXT,
  reason TEXT NOT NULL,
  submitter_alias TEXT,
  contact TEXT,
  source_channel TEXT,
  dedupe_key TEXT NOT NULL,
  receipt_token_hash TEXT NOT NULL,
  reviewer TEXT,
  review_note TEXT,
  public_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
  ON submissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_dedupe
  ON submissions(dedupe_key, status);

CREATE TABLE IF NOT EXISTS submission_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submission_events_submission
  ON submission_events(submission_id, created_at);

CREATE TABLE IF NOT EXISTS community_items (
  id TEXT PRIMARY KEY,
  source_submission_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('creator', 'work')),
  target_url TEXT NOT NULL,
  target_key TEXT NOT NULL,
  up_uid TEXT,
  up_name TEXT,
  title TEXT,
  episode INTEGER,
  category TEXT,
  recommendation_reason TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  FOREIGN KEY (source_submission_id) REFERENCES submissions(id) ON DELETE SET NULL,
  UNIQUE (type, target_key)
);

CREATE INDEX IF NOT EXISTS idx_community_items_published
  ON community_items(published, approved_at DESC);

CREATE TABLE IF NOT EXISTS submission_rate_limits (
  actor_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL
);

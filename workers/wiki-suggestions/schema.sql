CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  idea TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  preferred_editor TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 0,
  resolution TEXT,
  rejection_note TEXT
);
CREATE INDEX IF NOT EXISTS suggestions_pending ON suggestions(submitted_at, id) WHERE reviewed_at IS NULL;

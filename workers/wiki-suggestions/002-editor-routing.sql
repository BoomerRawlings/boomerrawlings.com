ALTER TABLE suggestions ADD COLUMN preferred_editor TEXT NOT NULL DEFAULT '';
ALTER TABLE suggestions ADD COLUMN visible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE suggestions ADD COLUMN resolution TEXT;
ALTER TABLE suggestions ADD COLUMN rejection_note TEXT;

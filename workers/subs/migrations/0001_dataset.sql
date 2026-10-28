CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE images (
 id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id), domain TEXT NOT NULL CHECK(domain IN ('camera','satellite')),
 status TEXT NOT NULL DEFAULT 'candidate', rights_tier TEXT NOT NULL, public_delivery INTEGER NOT NULL DEFAULT 0,
 sha256 TEXT, pixel_sha256 TEXT, phash TEXT, duplicate_group TEXT, event_group TEXT,
 revision INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL CHECK(json_valid(data)), updated_at TEXT NOT NULL
);
CREATE INDEX images_class_status ON images(class_id,status,domain);
CREATE INDEX images_public ON images(status,public_delivery,rights_tier);
CREATE INDEX images_event ON images(event_group);
CREATE UNIQUE INDEX accepted_original ON images(sha256) WHERE status='accepted';
CREATE UNIQUE INDEX accepted_pixels ON images(pixel_sha256) WHERE status='accepted';
CREATE TABLE assets (image_id TEXT NOT NULL REFERENCES images(id), kind TEXT NOT NULL, object_key TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, content_type TEXT NOT NULL, PRIMARY KEY(image_id,kind));
CREATE TABLE jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'running', month TEXT NOT NULL, max_requests INTEGER NOT NULL, max_bytes INTEGER NOT NULL, used_requests INTEGER NOT NULL DEFAULT 0, used_bytes INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, estimated_cost_usd REAL NOT NULL DEFAULT 0, data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL);
CREATE TABLE budgets (month TEXT PRIMARY KEY, external_spend_usd REAL NOT NULL DEFAULT 0, projected_other_usd REAL NOT NULL DEFAULT 0);
CREATE TABLE releases (id TEXT PRIMARY KEY, domain TEXT NOT NULL, rights_tier TEXT NOT NULL, status TEXT NOT NULL, public_delivery INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL);
CREATE TABLE release_images (release_id TEXT NOT NULL REFERENCES releases(id), image_id TEXT NOT NULL REFERENCES images(id), class_id TEXT NOT NULL, split TEXT NOT NULL, snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), PRIMARY KEY(release_id,image_id));
CREATE TABLE release_files (release_id TEXT NOT NULL REFERENCES releases(id), filename TEXT NOT NULL, object_key TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, content_type TEXT NOT NULL, PRIMARY KEY(release_id,filename));
CREATE TABLE audits (id INTEGER PRIMARY KEY AUTOINCREMENT, release_id TEXT NOT NULL REFERENCES releases(id), image_id TEXT NOT NULL REFERENCES images(id), result TEXT NOT NULL, reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE activity (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);

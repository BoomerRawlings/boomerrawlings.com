CREATE TABLE object_inventory (object_key TEXT PRIMARY KEY, bytes INTEGER NOT NULL, sha256 TEXT, state TEXT NOT NULL DEFAULT 'reserved', created_at TEXT NOT NULL);
INSERT OR IGNORE INTO object_inventory(object_key,bytes,sha256,state,created_at) SELECT object_key,bytes,sha256,'stored',strftime('%Y-%m-%dT%H:%M:%SZ','now') FROM assets;
INSERT OR IGNORE INTO object_inventory(object_key,bytes,sha256,state,created_at) SELECT object_key,bytes,sha256,'stored',strftime('%Y-%m-%dT%H:%M:%SZ','now') FROM release_files;
CREATE INDEX images_collection_job ON images(json_extract(data,'$.collection_job_id'));

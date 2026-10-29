"""Resumable, metadata-only discovery across a frozen commissioned-class roster.

Candidates are unverified source leads, not images or approvals. Codex usage limits
are enforced by the supervising agent; Python has no access to that account meter.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from pathlib import Path

from .discovery import durable_url, license_policy, plain
from .io import DatasetError, RateLimitedError, SafeRedirect, USER_AGENT, check_url, write_json
from .pipeline import check_id, now

PAGE_LIMIT = 16 * 1024 * 1024
MIMES = {"image/jpeg", "image/png", "image/webp", "image/tiff"}
DEFAULT_SOURCE_STATE = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / ".local/share"))) / "SUBS/source-state"


def _json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _key(url):
    parts = urllib.parse.urlsplit(durable_url(url))
    return urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), urllib.parse.unquote(parts.path), parts.query, ""))


@contextmanager
def _lock(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / "commons-metadata.lock").open("a+b") as stream:
        if stream.tell() == 0:
            stream.write(b"0"); stream.flush()
        stream.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (OSError, BlockingIOError):
            raise DatasetError("Another Commons metadata campaign is running; do not start a parallel queue") from None
        try:
            yield directory / "commons-metadata.json"
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


@contextmanager
def _db(path):
    file = Path(path) / "campaign.sqlite3"
    if not file.exists():
        raise DatasetError("Campaign does not exist; plan it first")
    db = sqlite3.connect(file, timeout=2)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def plan_campaign(classes, existing, path, *, target=400, max_queries_per_class=5, extra_queries=None):
    """Freeze a campaign; cap generated queries, preserving every explicit query."""
    if target != 400:
        raise DatasetError("Campaign goal must remain 400 originals/class")
    if not 1 <= max_queries_per_class <= 20:
        raise DatasetError("Require 1–20 generated queries/class")
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    if (path / "campaign.sqlite3").exists():
        raise DatasetError("Campaign already exists; resume it instead of replanning")
    envelope = classes if isinstance(classes, dict) else {"classes": classes}
    roster = envelope.get("classes", [])
    existing = list(existing)
    if not isinstance(roster, list):
        raise DatasetError("Expected a frozen classes list or roster object")
    eligible = []
    excluded = []
    seen_ids = set()
    for row in roster:
        cid = check_id(row.get("id", ""))
        if cid in seen_ids:
            raise DatasetError("Duplicate class ID in roster")
        seen_ids.add(cid)
        service = row.get("service", {})
        if service.get("status") != "commissioned":
            excluded.append({"id": cid, "status": service.get("status")})
            continue
        if not service.get("as_of") or not service.get("evidence"):
            raise DatasetError("Commissioned classes require dated service evidence")
        approved = len({_key(r["source"]["original_url"]) if r.get("source", {}).get("original_url") else r["id"]
                        for r in existing if r.get("class_id") == cid and r.get("status") == "accepted"
                        and r.get("domain") == "camera" and (r.get("id") or r.get("source", {}).get("original_url"))})
        names = [row.get("name", cid)] + list(row.get("aliases", []))
        queries = []
        for name in names:
            for alternative in re.split(r"\s*/\s*", str(name)):
                terms = [re.sub(r"\([^()]*\)", "", alternative)] + re.findall(r"\(([^()]*)\)", alternative)
                for term in terms:
                    term = " ".join(term.replace('"', '').split())
                    query = f'"{term}" submarine'
                    # Isolated suffixes in names such as Type 039A/B/C are not aliases.
                    if len(term) > 1 and query not in queries:
                        queries.append(query)
        queries = queries[:max_queries_per_class]
        for query in (extra_queries or {}).get(cid, []):
            if isinstance(query, str) and query.strip() and query.strip() not in queries:
                queries.append(query.strip())
        eligible.append({"id": cid, "name": row.get("name", cid), "service": service,
                         "approved_at_start": approved, "deficit_at_start": max(0, target - approved),
                         "queries": queries if approved < target else []})
    if not eligible:
        raise DatasetError("No commissioned classes in the frozen roster")
    eligible.sort(key=lambda r: (-r["deficit_at_start"], r["id"]))
    db = sqlite3.connect(path / "campaign.sqlite3")
    try:
        db.executescript("""
            CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            CREATE TABLE queries(id INTEGER PRIMARY KEY,class_id TEXT NOT NULL,query TEXT NOT NULL,
              cursor TEXT NOT NULL DEFAULT '{}',done INTEGER NOT NULL DEFAULT 0,requests INTEGER NOT NULL DEFAULT 0,
              buffer TEXT,position INTEGER NOT NULL DEFAULT 0,next_cursor TEXT);
            CREATE TABLE known(url TEXT NOT NULL,class_id TEXT NOT NULL,image_id TEXT,status TEXT,PRIMARY KEY(url,class_id));
            CREATE TABLE candidates(url TEXT PRIMARY KEY,id TEXT UNIQUE NOT NULL,data TEXT NOT NULL);
            CREATE TABLE claims(url TEXT NOT NULL,class_id TEXT NOT NULL,PRIMARY KEY(url,class_id));
        """)
        for depth in range(max(len(row["queries"]) for row in eligible)):
            for row in eligible:
                if depth < len(row["queries"]):
                    db.execute("INSERT INTO queries(class_id,query) VALUES(?,?)", (row["id"], row["queries"][depth]))
        for row in existing:
            url = row.get("source", {}).get("original_url")
            if url:
                key = _key(url)
                db.execute("INSERT OR IGNORE INTO known VALUES(?,?,?,?)", (key, row.get("class_id", ""), row.get("id"), row.get("status")))
                db.execute("INSERT OR IGNORE INTO claims VALUES(?,?)", (key, row.get("class_id", "")))
        config = {"schema_version": 1, "created_at": now(), "snapshot_date": envelope.get("snapshot_date"),
                  "target_per_class": target, "classes": eligible, "excluded_classes": excluded,
                  "scope": "Metadata candidates only; labels/rights/native pixels require review; no service refresh",
                  "usage_gate": "Supervising Codex agent must check remaining usage before and during bounded runs; stop below 20%. Python cannot read that meter."}
        for key, value in {"config": config, "requests": 0, "response_bytes": 0, "known_hits": 0, "repeat_hits": 0,
                           "filtered_hits": 0, "last_error": None}.items():
            db.execute("INSERT INTO meta VALUES(?,?)", (key, _json(value)))
        db.commit()
        write_json(path / "campaign.json", config)
    finally:
        db.close()
    return status(path)


def _meta(db, key, default=None):
    row = db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return json.loads(row[0]) if row else default


def _set(db, key, value):
    db.execute("INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, _json(value)))


def status(path):
    with _db(path) as db:
        config = _meta(db, "config")
        classes = []
        for row in config["classes"]:
            cid = row["id"]
            classes.append({"id": cid, "name": row["name"], "approved_at_start": row["approved_at_start"],
                            "deficit_at_start": row["deficit_at_start"],
                            "candidate_claims": db.execute("SELECT count(*) FROM claims JOIN candidates USING(url) WHERE class_id=?", (cid,)).fetchone()[0]})
        return {"snapshot_date": config.get("snapshot_date"), "eligible_classes": len(classes),
                "excluded_classes": len(config["excluded_classes"]), "goal_originals": len(classes) * 400,
                "approved_at_start": sum(r["approved_at_start"] for r in classes),
                "deficit_at_start": sum(r["deficit_at_start"] for r in classes),
                "unique_source_candidates": db.execute("SELECT count(*) FROM candidates").fetchone()[0],
                "queries_total": db.execute("SELECT count(*) FROM queries").fetchone()[0],
                "queries_complete": db.execute("SELECT count(*) FROM queries WHERE done=1").fetchone()[0],
                "buffered_pages": db.execute("SELECT count(*) FROM queries WHERE buffer IS NOT NULL").fetchone()[0],
                "requests": _meta(db, "requests"), "response_bytes": _meta(db, "response_bytes"),
                "known_hits": _meta(db, "known_hits"), "repeat_hits": _meta(db, "repeat_hits"),
                "filtered_hits": _meta(db, "filtered_hits"), "last_error": _meta(db, "last_error"),
                "approved_by_campaign": 0, "classes": classes}


def commons_page(query, continuation):
    params = {"action": "query", "format": "json", "formatversion": 2, "generator": "search", "gsrsearch": query,
              "gsrnamespace": 6, "gsrlimit": 50, "prop": "imageinfo", "iiprop": "url|size|mime|sha1|extmetadata", "maxlag": 5}
    # Continuation may only resume the fixed search, never replace the API operation.
    params.update({k: v for k, v in continuation.items() if k in {"continue", "gsroffset"}})
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    check_url(url)
    opener = urllib.request.build_opener(SafeRedirect(False, None))
    try:
        with opener.open(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=45) as response:
            raw = response.read(PAGE_LIMIT + 1)
            if len(raw) > PAGE_LIMIT:
                raise DatasetError("Commons metadata page exceeds 16 MiB")
            payload = json.loads(raw)
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise RateLimitedError(exc.headers.get("Retry-After")) from None
        raise DatasetError(f"Commons metadata HTTP {exc.code}; cursor retained") from None
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        raise DatasetError("Commons metadata unavailable; cursor retained") from None
    if not isinstance(payload, dict) or not isinstance(payload.get("query", {}), dict):
        raise DatasetError("Unexpected Commons response format; cursor retained")
    error = payload.get("error", {})
    if error:
        code = error.get("code") if isinstance(error, dict) else None
        if isinstance(code, str) and code in {"maxlag", "ratelimited"}:
            deferred = RateLimitedError("60")
            deferred.args = ("Commons metadata requested backoff; cursor retained",)
            raise deferred
        safe_code = re.sub(r"[^A-Za-z0-9_.-]", "", code)[:64] if isinstance(code, str) else ""
        raise DatasetError(f"Commons API error ({safe_code or 'unknown'}); cursor retained")
    if not isinstance(payload.get("query", {}).get("pages", []), list):
        raise DatasetError("Unexpected Commons page format; cursor retained")
    return payload, len(raw)


def _candidate(page, class_id, query):
    if not isinstance(page, dict) or not isinstance(page.get("imageinfo"), list) or not page["imageinfo"]:
        return None
    info = page["imageinfo"][0]
    if not isinstance(info, dict) or not isinstance(info.get("url"), str):
        return None
    url = info.get("url", "")
    try:
        parts = urllib.parse.urlsplit(url)
        port = parts.port
    except ValueError:
        return None
    if info.get("mime") not in MIMES or parts.scheme != "https" or parts.hostname != "upload.wikimedia.org":
        return None
    if parts.username or parts.password or port not in {None, 443} or "/thumb/" in urllib.parse.unquote(parts.path).lower():
        return None
    url = durable_url(url)
    metadata = info.get("extmetadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
    metadata = {key: {"value": str(value.get("value", "")) if isinstance(value, dict) else str(value)}
                for key, value in metadata.items()}
    page_url = info.get("descriptionurl", "")
    if not isinstance(page_url, str) or not page_url.startswith("https://commons.wikimedia.org/"):
        page_url = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(str(page.get("title", "")).replace(" ", "_"))
    proposed = license_policy(metadata)
    rights = dict(proposed, evidence_url=page_url, download_allowed=False, training_allowed=False, redistribution_allowed=False)
    return {"id": "image-" + hashlib.sha256((class_id + "|" + _key(url)).encode()).hexdigest()[:32],
            "class_id": class_id, "domain": "camera", "status": "candidate",
            "source": {"page_url": page_url, "original_url": url, "author": plain(metadata.get("Artist", {}).get("value", "")) or "unknown", "retrieved_at": now()},
            "rights": rights, "quality": {"original_width": info.get("width"), "original_height": info.get("height"),
                "subject_length_px": None, "original_resolution": False, "not_upscaled": False, "sharpness_ok": False},
            "target_bbox": None, "event_group": None,
            "discovery": {"provider": "wikimedia-commons", "query": query, "page_id": page.get("pageid"), "title": page.get("title"),
                "description": plain(metadata.get("ImageDescription", {}).get("value", ""))[:2000],
                "date_text": plain(metadata.get("DateTimeOriginal", {}).get("value", "")),
                "reported_width": info.get("width"), "reported_height": info.get("height"), "reported_bytes": info.get("size"),
                "reported_sha1": info.get("sha1"), "mime_hint": info.get("mime"), "proposed_rights": proposed,
                "class_claims": [class_id], "classification_verified": False, "rights_verified": False, "quality_reviewed": False,
                "note": "Metadata-only lead. Class claims are search targets, not verified labels. Exact rights and native original review required before download/approval."}}


def run_discovery(path, *, max_requests=25, max_candidates=1000, interval_seconds=10,
                  max_metadata_bytes=256 * 1024 * 1024, source_state_dir=None, fetch_page=None, clock=None, sleep=None):
    """Run bounded metadata work; buffered pages survive caps/crashes without loss."""
    if not 1 <= max_requests <= 1000 or not 1 <= max_candidates <= 50000:
        raise DatasetError("Require 1–1000 requests and 1–50000 new candidates/run")
    if interval_seconds < 1 or not PAGE_LIMIT <= max_metadata_bytes <= 1024 ** 3:
        raise DatasetError("Require >=1 second spacing and 16 MiB–1 GiB metadata ceiling")
    fetch_page, clock, sleep = fetch_page or commons_page, clock or time.time, sleep or time.sleep
    request_count = added = response_bytes = 0
    stop_reason, retry_at = "complete", None
    with _lock(source_state_dir or DEFAULT_SOURCE_STATE) as source_file:
        source = json.loads(source_file.read_text()) if source_file.exists() else {}
        with _db(path) as db:
            while added < max_candidates:
                q = db.execute("SELECT * FROM queries WHERE done=0 ORDER BY CASE WHEN buffer IS NULL THEN 1 ELSE 0 END,requests,id LIMIT 1").fetchone()
                if q is None:
                    break
                if q["buffer"] is None:
                    if request_count >= max_requests:
                        stop_reason = "request_limit"; break
                    if response_bytes > max_metadata_bytes - PAGE_LIMIT:
                        stop_reason = "byte_limit"; break
                    if source.get("retry_at_epoch", 0) > clock():
                        stop_reason, retry_at = "source_cooldown", source.get("retry_at"); break
                    wait = max(0, source.get("next_request_at", 0) - clock())
                    if wait:
                        sleep(wait)
                    request_count += 1
                    _set(db, "requests", _meta(db, "requests") + 1)
                    db.execute("UPDATE queries SET requests=requests+1 WHERE id=?", (q["id"],)); db.commit()
                    source["next_request_at"] = clock() + interval_seconds
                    write_json(source_file, source)
                    try:
                        payload, count = fetch_page(q["query"], json.loads(q["cursor"]))
                    except RateLimitedError as exc:
                        retry_at = exc.retry_at
                        source.update(retry_at=retry_at, retry_at_epoch=clock() + exc.retry_after_seconds)
                        write_json(source_file, source)
                        _set(db, "last_error", {"kind": "rate_limit", "retry_at": retry_at, "query_id": q["id"]}); db.commit()
                        stop_reason = "source_cooldown"; break
                    except DatasetError as exc:
                        _set(db, "last_error", {"kind": "source_error", "query_id": q["id"], "message": str(exc)}); db.commit()
                        raise
                    response_bytes += count
                    _set(db, "response_bytes", _meta(db, "response_bytes") + count)
                    _set(db, "last_error", None)
                    source.pop("retry_at", None); source.pop("retry_at_epoch", None)
                    write_json(source_file, source)
                    db.execute("UPDATE queries SET buffer=?,position=0,next_cursor=? WHERE id=?",
                               (_json(payload.get("query", {}).get("pages", [])), _json(payload.get("continue", {})), q["id"]))
                    db.commit()
                    q = db.execute("SELECT * FROM queries WHERE id=?", (q["id"],)).fetchone()
                pages = json.loads(q["buffer"])
                position = q["position"]
                while position < len(pages) and added < max_candidates:
                    row = _candidate(pages[position], q["class_id"], q["query"])
                    position += 1
                    if row is None:
                        _set(db, "filtered_hits", _meta(db, "filtered_hits") + 1)
                    else:
                        key = _key(row["source"]["original_url"])
                        db.execute("INSERT OR IGNORE INTO claims VALUES(?,?)", (key, q["class_id"]))
                        if db.execute("SELECT 1 FROM known WHERE url=? LIMIT 1", (key,)).fetchone():
                            _set(db, "known_hits", _meta(db, "known_hits") + 1)
                        elif db.execute("SELECT 1 FROM candidates WHERE url=?", (key,)).fetchone():
                            _set(db, "repeat_hits", _meta(db, "repeat_hits") + 1)
                        else:
                            db.execute("INSERT INTO candidates VALUES(?,?,?)", (key, row["id"], _json(row))); added += 1
                    db.execute("UPDATE queries SET position=? WHERE id=?", (position, q["id"]))
                if position == len(pages):
                    cursor = json.loads(q["next_cursor"])
                    db.execute("UPDATE queries SET buffer=NULL,position=0,cursor=?,next_cursor=NULL,done=? WHERE id=?", (_json(cursor), int(not cursor), q["id"]))
                db.commit()
            if added == max_candidates:
                stop_reason = "candidate_limit"
    return {"run": {"requests": request_count, "new_candidates": added, "response_bytes": response_bytes,
                    "stop_reason": stop_reason, "deferred": stop_reason == "source_cooldown", "retry_at": retry_at,
                    "media_downloads": 0, "approved": 0}, "cumulative": status(path)}


def export_candidates(path, output):
    """Write a replaceable JSONL review queue; SQLite remains authoritative."""
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(output.suffix + ".tmp")
    with _db(path) as db, temp.open("w", encoding="utf-8", newline="\n") as stream:
        for source in db.execute("SELECT url,data FROM candidates ORDER BY id"):
            row = json.loads(source["data"])
            row["discovery"]["class_claims"] = [r[0] for r in db.execute("SELECT class_id FROM claims WHERE url=? ORDER BY class_id", (source["url"],))]
            row["discovery"]["multiple_class_claims"] = len(row["discovery"]["class_claims"]) > 1
            stream.write(_json(row) + "\n")
    from .io import replace_with_retry
    replace_with_retry(temp, output)
    return {"exported_candidates": status(path)["unique_source_candidates"], "output": str(output), "approved": 0}

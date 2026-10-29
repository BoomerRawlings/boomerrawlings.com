"""Scoped API transport, idempotent uploads, and release downloads."""

from __future__ import annotations

import copy
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable
from pathlib import Path

from .io import DatasetError, MAX_BYTES, RateLimitedError, SafeRedirect, USER_AGENT, check_url, checksum_entries, download, read_jsonl, safe_path, sha256_file, write_json
from .pipeline import Store, check_id


class ApiClient:
    def __init__(self, base: str, token: str | None = None, *, allow_localhost: bool = False):
        self.base = base.rstrip("/")
        self.token = token
        self.allow_localhost = allow_localhost
        check_url(self.base, allow_localhost)

    def url(self, path: str) -> str:
        parsed = urllib.parse.urlsplit(path)
        if parsed.scheme or parsed.netloc:
            candidate = path
        elif path.startswith("/"):
            candidate = urllib.parse.urljoin(self.base, path)
        else:
            candidate = self.base + "/" + path
        base_parts, parts = urllib.parse.urlsplit(self.base), urllib.parse.urlsplit(candidate)
        if (base_parts.scheme, base_parts.netloc) != (parts.scheme, parts.netloc):
            raise DatasetError("API/download URL must remain on the configured origin")
        check_url(candidate, self.allow_localhost)
        return candidate

    def request(self, method: str, path: str, payload=None, *, headers=None, raw: bytes | None = None):
        body = raw if raw is not None else (json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None)
        request_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        if payload is not None:
            request_headers["Content-Type"] = "application/json"
        if self.token:
            request_headers["Authorization"] = "Bearer " + self.token
        request_headers.update(headers or {})
        opener = urllib.request.build_opener(SafeRedirect(self.allow_localhost, urllib.parse.urlsplit(self.base).netloc))
        attempts = 4 if method in {"GET", "HEAD"} else 1
        for attempt in range(attempts):
            try:
                with opener.open(urllib.request.Request(self.url(path), data=body, headers=request_headers, method=method), timeout=90) as response:
                    value = response.read(8 * 1024 * 1024 + 1)
                    if len(value) > 8 * 1024 * 1024:
                        raise DatasetError("API response exceeds8MiB")
                    return json.loads(value) if value else {}
            except urllib.error.HTTPError as exc:
                if exc.code in {429, 503}:
                    deferred = RateLimitedError(exc.headers.get("Retry-After") if exc.headers else None)
                    deferred.http_status = exc.code
                    # Reuse the shared Retry-After parser; its download-specific message does not describe API503.
                    deferred.args = (f"API request deferred (HTTP {exc.code}); retry no earlier than "
                                     f"{deferred.retry_at or str(deferred.retry_after_seconds) + ' seconds'}.",)
                    exc.close()
                    raise deferred from None
                transient = exc.code == 408 or exc.code >= 500
                exc.close()
                if not transient or attempt == attempts - 1:
                    # Error bodies can contain third-party data; never echo them or request headers.
                    raise DatasetError(f"API request failed (HTTP {exc.code}, {method} {path.split('?')[0]})") from None
            except (urllib.error.URLError, OSError):
                if attempt == attempts - 1:
                    raise DatasetError("API connection failed; rerun sync to resume writes after checking server state") from None
            time.sleep(min(2 ** attempt, 4))

    def list(self, path: str, query: dict | None = None) -> list[dict]:
        result = []
        offset = 0
        while True:
            params = dict(query or {}) | {"offset": offset, "limit": 100}
            page = self.request("GET", path + "?" + urllib.parse.urlencode(params))
            items = page.get("items", [])
            if not isinstance(items, list):
                raise DatasetError("API list response malformed")
            result.extend(items)
            offset += len(items)
            if not items or offset >= page.get("total", offset):
                return result

    def list_images_by_ids(self, image_ids: Iterable[str]) -> list[dict]:
        """Fetch only selected IDs; missing/private records stay absent, with no broader fallback."""
        if isinstance(image_ids, (str, bytes)):
            raise DatasetError("Expected a collection of stable image identifiers")
        selected = list(dict.fromkeys(check_id(value) for value in image_ids))
        result, seen = [], set()
        for start in range(0, len(selected), 50):
            batch = selected[start:start + 50]
            allowed = set(batch)
            offset = 0
            while True:
                query = urllib.parse.urlencode({"ids": ",".join(batch), "offset": offset, "limit": 50})
                page = self.request("GET", "images?" + query)
                if not isinstance(page, dict) or not isinstance(page.get("items"), list):
                    raise DatasetError("Selected-image response malformed")
                items, total = page["items"], page.get("total")
                if type(total) is not int or not 0 <= total <= len(batch) or offset + len(items) > total:
                    raise DatasetError("Selected-image pagination malformed")
                for row in items:
                    ident = row.get("id") if isinstance(row, dict) else None
                    if not isinstance(ident, str) or ident not in allowed or ident in seen:
                        raise DatasetError("Selected-image response contains unexpected or duplicate identifiers")
                    seen.add(ident)
                    result.append(row)
                offset += len(items)
                if offset >= total:
                    break
                if not items:
                    raise DatasetError("Selected-image pagination stopped before its declared total")
        return result

    def sync(self, store: Store, job_id: str, *, max_requests: int = 1000, max_bytes: int = 1024 ** 3,
             estimated_cost_usd: float = 0, update_metadata: bool = False) -> dict:
        check_id(job_id)
        records = store.rows()
        candidates = store.candidates()
        existing_jobs = self.list("jobs")
        if not any(job.get("id") == job_id for job in existing_jobs):
            self.request("POST", "jobs", {"id": job_id, "classes": sorted({row["class_id"] for row in records}),
                         "max_requests": max_requests, "max_bytes": max_bytes, "estimated_cost_usd": estimated_cost_usd})
        selected_ids = [row["id"] for row in records] + [row["id"] for row in candidates]
        remote_rows = {row["id"]: row for row in self.list_images_by_ids(selected_ids)}
        uploaded = skipped = 0
        processed_ids = {row["id"] for row in records}
        discovered = 0
        for candidate in candidates:
            if candidate["id"] in processed_ids or candidate["id"] in remote_rows:
                continue
            payload = {key: copy.deepcopy(value) for key, value in candidate.items()
                       if key not in {"assets", "revision", "verification", "discovery", "held_reasons"}}
            payload["status"] = "candidate"
            payload["collection_job_id"] = job_id
            self.request("PUT", "images/" + candidate["id"], payload)
            discovered += 1
        for row in records:
            remote = remote_rows.get(row["id"])
            if remote and remote.get("status") == "accepted" and not update_metadata:
                skipped += 1
                continue
            payload = {key: copy.deepcopy(value) for key, value in row.items()
                       if key not in {"assets", "revision", "verification", "held_reasons", "duplicate_of", "target_phash", "unchanged", "review_history"}}
            payload["status"] = "candidate"
            payload["collection_job_id"] = job_id
            changes = remote and any(remote.get(key) != value for key, value in payload.items() if key not in {"status", "collection_job_id"})
            if changes and remote.get("sha256") and not update_metadata:
                raise DatasetError("Local/remote metadata differs; inspect corrections and use --update-metadata explicitly")
            if remote is None or not remote.get("sha256") or (update_metadata and changes):
                result = self.request("PUT", "images/" + row["id"], payload,
                                      headers={"If-Match": str(remote["revision"])} if remote else None)
                remote = result.get("image", result.get("item", result))
            for kind in ("original", "crop", "preview"):
                asset = row["assets"][kind]
                if remote.get("assets", {}).get(kind, {}).get("sha256") == asset["sha256"]:
                    continue
                path = safe_path(store.root, asset["file_name"])
                if path.stat().st_size > MAX_BYTES or sha256_file(path) != asset["sha256"]:
                    raise DatasetError("Local asset checksum mismatch; upload canceled")
                self.request("PUT", f"images/{row['id']}/assets/{kind}", raw=path.read_bytes(), headers={
                    "Content-Type": asset["content_type"], "Content-Length": str(path.stat().st_size),
                    "X-Content-SHA256": asset["sha256"], "X-Job-Id": job_id})
                uploaded += 1
        request_count = store.db.execute("SELECT COALESCE(SUM(requests),0) FROM transfers").fetchone()[0]
        # Report collection HTTP work once per local job checkpoint. Server independently meters upload bytes.
        checkpoint = store.root / "sync" / f"{job_id}.json"
        reported = json.loads(checkpoint.read_text(encoding="utf-8")).get("reported_requests", 0) if checkpoint.exists() else 0
        delta = max(0, request_count - reported)
        if delta:
            self.request("PATCH", "jobs/" + job_id, {"requests_delta": delta, "bytes_delta": 0, "cost_delta_usd": 0})
            write_json(checkpoint, {"reported_requests": request_count})
        return {"records": len(records), "discovered_candidates": discovered, "uploaded_assets": uploaded, "already_accepted": skipped,
                "note": "Uploads remain candidates until a separate verifier accepts them."}

    def verify(self, image_id: str, verification: dict, reason: str = ""):
        check_id(image_id)
        record = self.request("GET", "images/" + image_id)
        record = record.get("image", record.get("item", record))
        return self.request("POST", f"images/{image_id}/verify", {"verification": verification, "reason": reason},
                            headers={"If-Match": str(record["revision"])})

    def download_release(self, release_id: str, output: Path, *, include_originals: bool = True) -> dict:
        check_id(release_id)
        release = self.request("GET", "releases/" + release_id)
        release = release.get("release", release.get("item", release))
        if release.get("status") != "provisional":
            raise DatasetError("Release is not available for training (unpublished, failed, or withdrawn)")
        prior_descriptor = output / "release.json"
        if prior_descriptor.exists():
            previous = json.loads(prior_descriptor.read_text(encoding="utf-8"))
            if previous.get("id") != release_id:
                raise DatasetError("Output belongs to another release; choose a separate immutable directory")
        elif output.exists() and any(output.iterdir()):
            raise DatasetError("Nonempty output has no matching release descriptor; choose a new directory")
        output.mkdir(parents=True, exist_ok=True)
        (output / "COMPLETE.json").unlink(missing_ok=True)
        write_json(output / "release.json", release)
        filenames = release.get("files") or ["classes.json", "images.jsonl", "README.md", "ATTRIBUTION.json", "coverage.json", "CHANGELOG.md", "checksums.json"]
        if not isinstance(filenames, list) or not all(isinstance(name, str) for name in filenames) or "checksums.json" not in filenames:
            raise DatasetError("Release must declare its metadata files and checksums.json")
        checksum_data = self.request("GET", f"releases/{release_id}/files/checksums.json")
        checksums = checksum_entries(checksum_data)
        required_files = set(filenames) - {"checksums.json"}
        if not required_files.issubset(checksums):
            raise DatasetError("Release checksum manifest omits required metadata files")
        write_json(output / "checksums.json", checksum_data)
        for filename in filenames:
            if filename == "checksums.json":
                continue
            target = safe_path(output, filename)
            download(self.url(f"releases/{release_id}/files/{urllib.parse.quote(filename, safe='')}"), target,
                     expected_sha256=checksums[filename], token=self.token, allow_localhost=self.allow_localhost, max_bytes=256 * 1024 * 1024)
        for filename in required_files:
            path = safe_path(output, filename)
            if not path.is_file() or sha256_file(path) != checksums[filename]:
                raise DatasetError("Release metadata checksum mismatch")
        count = 0
        for row in read_jsonl(output / "images.jsonl"):
            for kind in (("original", "crop") if include_originals else ("crop",)):
                asset = row["assets"][kind]
                target = safe_path(output, asset["file_name"])
                download(self.url(asset["download_url"]), target, expected_sha256=asset["sha256"],
                         token=self.token, allow_localhost=self.allow_localhost, max_bytes=MAX_BYTES)
                count += 1
        write_json(output / "COMPLETE.json", {"release_id": release_id,
                                              "views": ["original", "crop"] if include_originals else ["crop"],
                                              "images_sha256": sha256_file(output / "images.jsonl"),
                                              "checksums_sha256": sha256_file(output / "checksums.json")})
        return {"release_id": release_id, "downloaded_assets": count, "status": release.get("status", "provisional")}

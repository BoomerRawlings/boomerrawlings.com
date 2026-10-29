"""Bounded, resumable transfers and safe local paths. No credentials in manifests."""

from __future__ import annotations

import hashlib
import http.client
import ipaddress
import json
import math
import os
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path, PurePosixPath

MAX_BYTES = 64 * 1024 * 1024
USER_AGENT = "SUBS-DatasetBot/1.0 (https://boomerrawlings.com/; original-image research)"


class DatasetError(ValueError):
    """An actionable validation/transfer failure, without request credentials."""


class RateLimitedError(DatasetError):
    """A deferred transfer. Callers must pause collection from the affected source."""

    def __init__(self, retry_after: str | None, *, http_status: int = 429):
        self.http_status = http_status
        current = time.time()
        seconds = 60
        if retry_after:
            try:
                value = retry_after.strip()
                if value.isdecimal():
                    seconds = int(value)
                else:
                    deadline = parsedate_to_datetime(value)
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    seconds = math.ceil(deadline.timestamp() - current)
            except (ValueError, TypeError, OverflowError):
                pass
        # Even a past/zero header is deferred to the caller, never immediately retried.
        self.retry_after_seconds = max(1, seconds)
        try:
            self.retry_at = datetime.fromtimestamp(math.ceil(current + self.retry_after_seconds), timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        except (ValueError, OverflowError, OSError):
            self.retry_at = None
        timing = self.retry_at or f"after {self.retry_after_seconds} seconds"
        super().__init__(f"Download deferred (HTTP {http_status}); retry no earlier than {timing}. Pause this source; partial bytes retained.")


class RollingBandwidthLimiter:
    """Conservative16Mbps: <=20,000,000 body bytes in any rolling10 seconds.

    One serialized source queue must own this limiter. A caller may persist its
    small event list under its provider lock to preserve limits across processes.
    Reserve before reading; charge at receipt, even if validation later fails.
    """
    window_seconds = 10
    window_bytes = 20_000_000

    def __init__(self, events=None, *, save=None, clock=None, sleep=None):
        if events is not None and not isinstance(events, list):
            raise DatasetError("Malformed persisted bandwidth history")
        self.events = list(events or [])
        if any(not isinstance(e, (list, tuple)) or len(e) != 2 or type(e[0]) not in (int, float)
               or not math.isfinite(e[0]) or type(e[1]) is not int or e[1] <= 0 for e in self.events):
            raise DatasetError("Malformed persisted bandwidth history")
        self.save = save
        self.clock = clock or time.time
        self.sleep = sleep or time.sleep

    def wait_for(self, size, *, deadline=None):
        if not 0 < size <= self.window_bytes:
            raise DatasetError("Invalid bandwidth reservation")
        while True:
            current = self.clock()
            self.events = [e for e in self.events if e[0] > current - self.window_seconds]
            if sum(e[1] for e in self.events) + size <= self.window_bytes:
                return
            delay = max(0.001, min(e[0] for e in self.events) + self.window_seconds - current)
            if deadline is not None and time.monotonic() + delay >= deadline:
                raise DatasetError("Transfer deadline reached while pacing; partial bytes retained")
            self.sleep(min(delay, 1))

    def charge(self, size):
        self.events.append([self.clock(), size])
        if self.save:
            self.save(self.events)


_COMMONS_BANDWIDTH = RollingBandwidthLimiter()


def remaining_timeout(deadline):
    remaining = 45 if deadline is None else min(45, deadline - time.monotonic())
    if remaining <= 0:
        raise DatasetError("Transfer deadline reached; partial bytes retained")
    return remaining


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_path(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or "\\" in relative or ":" in relative:
        raise DatasetError("Expected a portable relative file path")
    parsed = PurePosixPath(relative)
    if parsed.is_absolute() or any(part in ("..", ".") for part in relative.split("/")):
        raise DatasetError("Unsafe relative file path")
    target = root.joinpath(*parsed.parts).resolve()
    if not target.is_relative_to(root.resolve()):
        raise DatasetError("Path escapes dataset directory")
    return target


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    replace_with_retry(temporary, path)


def replace_with_retry(source: Path, target: Path) -> None:
    """Bounded retry for Windows sync/antivirus locks; never copy a half-published release."""
    for attempt in range(7):
        try:
            source.replace(target)
            return
        except PermissionError:
            if attempt == 6:
                raise DatasetError("Atomic publish blocked by a file lock; completed staging data retained. Retry after the sync/antivirus lock clears.") from None
            time.sleep(min(0.1 * 2 ** attempt, 2))


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8-sig") as stream:
        for number, line in enumerate(stream, 1):
            if line.strip():
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise DatasetError(f"Invalid JSONL at line {number}") from exc
                if not isinstance(row, dict):
                    raise DatasetError(f"JSONL line {number} must be an object")
                rows.append(row)
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def checksum_entries(payload: dict) -> dict[str, str]:
    """Read the actual Worker checksum schema, plus local flat checksum maps."""
    if not isinstance(payload, dict):
        raise DatasetError("Malformed checksum manifest")
    if "algorithm" in payload or "files" in payload:
        if payload.get("algorithm") != "sha256" or not isinstance(payload.get("files"), list):
            raise DatasetError("Unsupported checksum manifest format")
        entries = {}
        for record in payload["files"]:
            if not isinstance(record, dict) or not isinstance(record.get("filename"), str):
                raise DatasetError("Malformed checksum file entry")
            filename = record["filename"]
            if filename in entries:
                raise DatasetError("Duplicate checksum file entry")
            entries[filename] = record.get("sha256")
    else:
        entries = payload
    if not entries or any(not isinstance(key, str) or not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value) for key, value in entries.items()):
        raise DatasetError("Checksum manifest must contain named SHA-256 digests")
    return entries


def check_url(url: str, allow_localhost: bool = False) -> None:
    parts = urllib.parse.urlsplit(url)
    if parts.username or parts.password or parts.fragment or not parts.hostname:
        raise DatasetError("URL must have a host and no credentials or fragment")
    loopback_name = parts.hostname in {"localhost", "127.0.0.1", "::1"}
    if parts.scheme != "https" and not (allow_localhost and loopback_name and parts.scheme == "http"):
        raise DatasetError("Downloads require HTTPS (loopback HTTP is test-only)")
    try:
        addresses = socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == "https" else 80))
    except OSError as exc:
        raise DatasetError("Download host could not be resolved") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global and not (allow_localhost and ip.is_loopback):
            raise DatasetError("Private-network download destinations are not allowed")


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allow_localhost: bool, credential_origin: str | None):
        self.allow_localhost = allow_localhost
        self.credential_origin = credential_origin

    def redirect_request(self, request, response, code, message, headers, new_url):
        check_url(new_url, self.allow_localhost)
        redirected = super().redirect_request(request, response, code, message, headers, new_url)
        if redirected is not None:
            old = urllib.parse.urlsplit(request.full_url)
            new = urllib.parse.urlsplit(new_url)
            if (old.scheme, old.netloc) != (new.scheme, new.netloc):
                redirected.remove_header("Authorization")
        return redirected


class OriginalRedirect(SafeRedirect):
    def redirect_request(self, request, response, code, message, headers, new_url):
        if any(urllib.parse.urlsplit(url).hostname == "upload.wikimedia.org" for url in (request.full_url, new_url)):
            raise DatasetError("Unexpected original-file redirect; resolve source identity before another request")
        return super().redirect_request(request, response, code, message, headers, new_url)


def download(url: str, target: Path, *, expected_sha256: str | None = None,
             max_bytes: int = MAX_BYTES, retries: int = 3, token: str | None = None,
             allow_localhost: bool = False, on_request=None, on_bytes=None,
             max_transfer_bytes: int | None = None, bandwidth_limiter=None, deadline=None) -> Path:
    """Resume partial bytes; a changed representation restarts, never appends corrupt data."""
    remaining_timeout(deadline)
    check_url(url, allow_localhost)
    if max_transfer_bytes is not None and (type(max_transfer_bytes) is not int or max_transfer_bytes < 0):
        raise DatasetError("Invalid transfer byte budget")
    transfer_bytes = 0
    limiter = bandwidth_limiter
    if urllib.parse.urlsplit(url).hostname == "upload.wikimedia.org" and limiter is None:
        limiter = _COMMONS_BANDWIDTH
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if target.stat().st_size > max_bytes:
            raise DatasetError("Existing file exceeds byte limit")
        if expected_sha256 and sha256_file(target) == expected_sha256:
            return target
        if not expected_sha256:
            return target
        target.unlink()
    partial = target.with_suffix(target.suffix + ".part")
    resume_meta = partial.with_suffix(partial.suffix + ".json")
    opener = urllib.request.build_opener(OriginalRedirect(allow_localhost, urllib.parse.urlsplit(url).netloc))
    for attempt in range(retries + 1):
        try:
            offset = partial.stat().st_size if partial.exists() else 0
            if offset > max_bytes:
                raise DatasetError("Partial download exceeds byte limit")
            headers = {"User-Agent": USER_AGENT, "Accept-Encoding": "identity"}
            if token:
                headers["Authorization"] = "Bearer " + token
            if offset:
                headers["Range"] = f"bytes={offset}-"
                if resume_meta.exists():
                    validator = json.loads(resume_meta.read_text(encoding="utf-8")).get("validator")
                    if validator:
                        headers["If-Range"] = validator
            remaining_timeout(deadline)
            if max_transfer_bytes is not None and transfer_bytes >= max_transfer_bytes:
                raise DatasetError("Transfer byte budget exhausted; partial bytes retained")
            if on_request:
                on_request()
            with opener.open(urllib.request.Request(url, headers=headers), timeout=remaining_timeout(deadline)) as response:
                check_url(response.url, allow_localhost)
                append = offset > 0 and response.status == 206
                if append and not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
                    raise DatasetError("Invalid partial response offset")
                if not append:
                    offset = 0
                length_header = response.headers.get("Content-Length")
                expected_length = int(length_header) if length_header else None
                if expected_length is not None and expected_length + offset > max_bytes:
                    raise DatasetError("Download exceeds byte limit")
                if expected_length is not None and max_transfer_bytes is not None and transfer_bytes + expected_length > max_transfer_bytes:
                    raise DatasetError("Response exceeds remaining transfer budget; no body downloaded")
                encoding = response.headers.get("Content-Encoding", "identity")
                if encoding not in ("identity", ""):
                    raise DatasetError("Unexpected transfer encoding; original bytes required")
                validator = response.headers.get("ETag") or response.headers.get("Last-Modified")
                write_json(resume_meta, {"validator": validator})
                received = 0
                with partial.open("ab" if append else "wb") as stream:
                    while expected_length is None or received < expected_length:
                        remaining_timeout(deadline)
                        size = min(256 * 1024, max_bytes - offset - received)
                        if max_transfer_bytes is not None:
                            size = min(size, max_transfer_bytes - transfer_bytes)
                        if expected_length is not None:
                            size = min(size, expected_length - received)
                        if size <= 0:
                            raise DatasetError("Transfer/file byte budget exhausted; partial bytes retained")
                        if limiter:
                            limiter.wait_for(size, deadline=deadline)
                        # read1 returns available bytes without waiting to fill the entire chunk.
                        incomplete = False
                        try:
                            chunk = response.read1(size) if hasattr(response, "read1") else response.read(size)
                        except http.client.IncompleteRead as exc:
                            chunk, incomplete = exc.partial, True
                        if not chunk:
                            if incomplete:
                                raise OSError("Incomplete response")
                            break
                        transfer_bytes += len(chunk)
                        if limiter:
                            limiter.charge(len(chunk))
                        if on_bytes:
                            on_bytes(len(chunk))
                        received += len(chunk)
                        if offset + received > max_bytes:
                            raise DatasetError("Download exceeds byte limit")
                        stream.write(chunk)
                        remaining_timeout(deadline)
                        if incomplete:
                            raise OSError("Incomplete response")
                if expected_length is not None and received != expected_length:
                    raise OSError("Incomplete response")
            if expected_sha256 and sha256_file(partial) != expected_sha256:
                partial.unlink(missing_ok=True)
                resume_meta.unlink(missing_ok=True)
                raise DatasetError("Downloaded checksum mismatch")
            replace_with_retry(partial, target)
            resume_meta.unlink(missing_ok=True)
            return target
        except urllib.error.HTTPError as exc:
            if exc.code in {429, 503}:
                deferred = RateLimitedError(exc.headers.get("Retry-After") if exc.headers else None, http_status=exc.code)
                exc.close()
                raise deferred from None
            if exc.code == 416 and expected_sha256 and partial.exists() and sha256_file(partial) == expected_sha256:
                replace_with_retry(partial, target)
                resume_meta.unlink(missing_ok=True)
                return target
            if exc.code < 500 and exc.code != 408:
                raise DatasetError(f"Download refused (HTTP {exc.code})") from None
            if attempt == retries:
                raise DatasetError(f"Download unavailable (HTTP {exc.code})") from None
        except (OSError, TimeoutError, urllib.error.URLError) as exc:
            if attempt == retries:
                raise DatasetError("Download failed after retries; partial bytes retained") from None
        if attempt < retries:
            delay = min(2 ** attempt, 8)
            if deadline is not None and time.monotonic() + delay >= deadline:
                raise DatasetError("Transfer deadline reached before retry; partial bytes retained")
            time.sleep(delay)
    raise DatasetError("Download failed")

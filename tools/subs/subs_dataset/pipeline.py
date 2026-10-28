"""Original-first ingestion. Acceptance is evidence-backed, never inferred from pixels alone."""

from __future__ import annotations

import copy
import hashlib
import json
import math
import re
import shutil
import sqlite3
import struct
import urllib.parse
import warnings
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

from .io import DatasetError, MAX_BYTES, download, safe_path, sha256_file, write_json

Image.MAX_IMAGE_PIXELS = 80_000_000
FORMATS = {"JPEG": ("jpg", "image/jpeg"), "PNG": ("png", "image/png"),
           "WEBP": ("webp", "image/webp"), "TIFF": ("tif", "image/tiff")}
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,95}$")
SHARPNESS_FLOOR = 8.0
NEAR_DUPLICATE_DISTANCE = 6


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def check_id(value: str) -> str:
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise DatasetError("Invalid stable identifier")
    return value


def evidence_url(value) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = urllib.parse.urlsplit(value)
        sensitive = {"token", "access_token", "api_key", "apikey", "key", "signature", "x-amz-signature", "x-amz-credential"}
        return (parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password
                and not any(key.lower() in sensitive for key, _ in urllib.parse.parse_qsl(parsed.query)))
    except ValueError:
        return False


def open_original(path: Path) -> tuple[Image.Image, str]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as source:
                image_format = source.format
                if image_format not in FORMATS:
                    raise DatasetError("Only JPEG, PNG, WebP, or TIFF originals are supported")
                if getattr(source, "n_frames", 1) != 1:
                    raise DatasetError("Animated/multi-page images need an explicitly selected original scene")
                source.load()
                oriented = ImageOps.exif_transpose(source)
                if "A" in oriented.getbands():
                    background = Image.new("RGB", oriented.size, "white")
                    background.paste(oriented, mask=oriented.getchannel("A"))
                    return background, image_format
                return oriented.convert("RGB"), image_format
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise DatasetError("Invalid, corrupt, or excessively large original image") from exc


def phash(image: Image.Image) -> str:
    """64-bit perceptual DCT hash; exact bytes and canonical pixels are also recorded."""
    pixels = image.convert("L").resize((32, 32), Image.Resampling.LANCZOS).tobytes()
    cosines = [[math.cos((2 * x + 1) * u * math.pi / 64) for x in range(32)] for u in range(8)]
    horizontal = [[sum(pixels[y * 32 + x] * cosines[u][x] for x in range(32))
                   for u in range(8)] for y in range(32)]
    coefficients = [sum(horizontal[y][u] * cosines[v][y] for y in range(32))
                    for v in range(8) for u in range(8)]
    median = sorted(coefficients[1:])[len(coefficients[1:]) // 2]
    bits = 0
    for index, coefficient in enumerate(coefficients):
        if coefficient > median:
            bits |= 1 << (63 - index)
    return f"{bits:016x}"


def hash_distance(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def crop_box(bbox, width: int, height: int) -> tuple[int, int, int, int]:
    if (not isinstance(bbox, (list, tuple)) or len(bbox) != 4
            or any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in bbox)):
        raise DatasetError("target_bbox must be [x,y,width,height] in oriented native pixels")
    x, y, w, h = bbox
    if any(int(value) != value for value in bbox):
        raise DatasetError("Target crop coordinates must use whole native pixels")
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > width or y + h > height:
        raise DatasetError("Target crop is outside native image dimensions")
    return math.floor(x), math.floor(y), math.ceil(x + w), math.ceil(y + h)


def sharpness(image: Image.Image) -> float:
    """Variance of a Laplacian on the target crop, normalized to <=512px."""
    gray = image.convert("L")
    gray.thumbnail((512, 512), Image.Resampling.LANCZOS)
    if min(gray.size) < 5:
        return 0.0
    laplacian = gray.filter(ImageFilter.Kernel((3, 3), (0, 1, 0, 1, -4, 1, 0, 1, 0), scale=1, offset=128))
    # Pillow leaves border pixels unfiltered. Exclude them; otherwise a flat/blurred
    # target can appear sharp because its original border differs from the128 offset.
    interior = laplacian.crop((1, 1, laplacian.width - 1, laplacian.height - 1))
    return round(ImageStat.Stat(interior).var[0], 4)


def inspect(path: Path, bbox=None) -> dict:
    if path.stat().st_size > MAX_BYTES:
        raise DatasetError("Original exceeds 64 MiB limit")
    image, image_format = open_original(path)
    target = image.crop(crop_box(bbox, *image.size)) if bbox else image
    digest = hashlib.sha256(struct.pack(">II", *image.size) + image.tobytes()).hexdigest()
    return {"width": image.width, "height": image.height, "format": image_format,
            "bytes": path.stat().st_size, "sha256": sha256_file(path), "pixel_sha256": digest,
            "phash": phash(image), "target_phash": phash(target), "sharpness_score": sharpness(target)}


def eligibility_errors(record: dict, *, require_verification: bool = True) -> list[str]:
    errors = []
    if record.get("domain") not in {"camera", "satellite"}:
        errors.append("domain must be camera or satellite")
    rights = record.get("rights", {})
    if rights.get("tier") not in {"commercial", "research"}:
        errors.append("rights tier missing")
    for field in ("license", "attribution"):
        if not isinstance(rights.get(field), str) or not rights[field].strip():
            errors.append(f"rights.{field} missing")
    if not evidence_url(rights.get("evidence_url")):
        errors.append("exact-source rights evidence missing")
    if rights.get("download_allowed") is not True or rights.get("training_allowed") is not True:
        errors.append("download/training permission not established")
    if not isinstance(rights.get("redistribution_allowed"), bool):
        errors.append("public delivery permission must be explicitly true or false")
    source = record.get("source", {})
    if not evidence_url(source.get("page_url")) or not evidence_url(source.get("original_url")):
        errors.append("HTTPS source page and original URL required without embedded credentials")
    if not isinstance(source.get("author"), str) or not source["author"].strip():
        errors.append("source author or explicit unknown required")
    quality = record.get("quality", {})
    for flag in ("sharpness_ok", "original_resolution", "not_upscaled"):
        if quality.get(flag) is not True:
            errors.append(f"quality.{flag} not established")
    width, height = quality.get("original_width", 0), quality.get("original_height", 0)
    subject = quality.get("subject_length_px", 0)
    if (any(isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) for n in (width, height, subject))
            or min(width, height, subject) <= 0):
        errors.append("invalid native dimensions/subject measurement")
    else:
        try:
            crop_box(record.get("target_bbox"), width, height)
            if subject > max(record["target_bbox"][2:]):
                errors.append("subject length exceeds target crop")
        except DatasetError as exc:
            errors.append(str(exc))
        if record.get("domain") == "camera" and (max(width, height) < 1200 or subject < 400):
            errors.append("camera minimum: 1200px frame / 400px native subject")
        if record.get("domain") == "satellite":
            gsd = quality.get("gsd_m_per_px")
            if subject < 200 or isinstance(gsd, bool) or not isinstance(gsd, (int, float)) or not math.isfinite(gsd) or not 0 < gsd <= 0.5:
                errors.append("satellite minimum: 200px native subject / GSD <=0.5m")
    if not isinstance(record.get("event_group"), str) or not record["event_group"].strip():
        errors.append("capture event/acquisition group required")
    if require_verification:
        review = record.get("verification", {})
        if review.get("decision") != "accept":
            errors.append("independent acceptance pending")
        if (not review.get("collector") or not review.get("verified_by")
                or review.get("collector").strip().casefold() == review.get("verified_by").strip().casefold()):
            errors.append("collector and verifier must be independent")
        if not review.get("verified_at"):
            errors.append("verification date missing")
        evidence = review.get("class_evidence", [])
        if not isinstance(evidence, list) or not evidence or not all(evidence_url(url) for url in evidence):
            errors.append("class identification evidence missing")
    return errors


class Store:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.root / "collection.sqlite3")
        self.db.execute("CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, sha256 TEXT UNIQUE, pixel_sha256 TEXT, phash TEXT, data TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, data TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0)")
        self.db.commit()

    def close(self):
        self.db.close()

    def rows(self) -> list[dict]:
        return [json.loads(row[0]) for row in self.db.execute("SELECT data FROM records ORDER BY id")]

    def candidates(self) -> list[dict]:
        return [json.loads(row[1]) | {"id": row[0]} for row in self.db.execute("SELECT id,data FROM candidates ORDER BY id")]

    def get(self, image_id: str) -> dict | None:
        row = self.db.execute("SELECT data FROM records WHERE id=?", (image_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def save(self, record: dict):
        self.db.execute("INSERT INTO records(id,sha256,pixel_sha256,phash,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,pixel_sha256=excluded.pixel_sha256,phash=excluded.phash",
                        (record["id"], record.get("sha256"), record.get("pixel_sha256"), record.get("phash"), json.dumps(record)))
        self.db.commit()

    def discover(self, candidate: dict) -> str:
        source_url = candidate.get("source", {}).get("original_url") or candidate.get("source", {}).get("page_url")
        if not evidence_url(source_url):
            raise DatasetError("Candidate needs a non-secret HTTPS source URL")
        identifier = "image-" + hashlib.sha256((candidate.get("class_id", "") + "|" + source_url).encode()).hexdigest()[:32]
        public_record = copy.deepcopy(candidate)
        public_record.pop("download_url", None)
        public_record.pop("local_file", None)
        self.db.execute("INSERT INTO candidates(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", (identifier, json.dumps(public_record)))
        self.db.commit()
        return identifier

    def ingest(self, candidate: dict, *, allow_localhost: bool = False, max_requests: int = 1000, on_request=None) -> dict:
        check_id(candidate.get("class_id", ""))
        candidate_id = self.discover(candidate)
        existing_candidate = self.get(candidate_id)
        if existing_candidate:
            if candidate.get("expected_sha256") and candidate["expected_sha256"] != existing_candidate.get("sha256"):
                raise DatasetError("Original changed at the same source URL; use a separately versioned source record")
            return existing_candidate | {"unchanged": True}
        if candidate.get("rights", {}).get("download_allowed") is not True:
            return {"candidate_id": candidate_id, "status": "held", "held_reasons": ["Download permission not established; no bytes fetched"]}
        request_count = 0

        def charge_request():
            nonlocal request_count
            request_count += 1
            if request_count > max_requests:
                raise DatasetError("Collection request limit reached")
            self.db.execute("INSERT INTO transfers(id,requests) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET requests=requests+1", (candidate_id,))
            self.db.commit()
            if on_request:
                on_request()

        incoming = self.root / "incoming" / (candidate_id + ".original")
        if candidate.get("local_file"):
            local = Path(candidate["local_file"]).resolve()
            if not local.is_file() or local.stat().st_size > MAX_BYTES:
                raise DatasetError("Local original missing or larger than64MiB")
            incoming.parent.mkdir(parents=True, exist_ok=True)
            if not incoming.exists() or sha256_file(local) != sha256_file(incoming):
                shutil.copyfile(local, incoming)
        else:
            download(candidate.get("download_url") or candidate["source"]["original_url"], incoming,
                     expected_sha256=candidate.get("expected_sha256"), allow_localhost=allow_localhost, on_request=charge_request)
        details = inspect(incoming, candidate.get("target_bbox"))
        if candidate.get("expected_sha256") and candidate["expected_sha256"] != details["sha256"]:
            raise DatasetError("Local original checksum differs from expected source checksum")
        image_id = candidate_id
        existing_row = self.db.execute("SELECT data FROM records WHERE sha256=?", (details["sha256"],)).fetchone()
        existing = json.loads(existing_row[0]) if existing_row else None
        if existing:
            if existing["class_id"] != candidate["class_id"]:
                raise DatasetError("Same original already belongs to another class; owner correction required")
            return existing | {"unchanged": True}
        image, image_format = open_original(incoming)
        ext, content_type = FORMATS[image_format]
        original_relative = f"originals/{image_id}.{ext}"
        original_path = safe_path(self.root, original_relative)
        original_path.parent.mkdir(parents=True, exist_ok=True)
        incoming.replace(original_path)
        bbox = candidate.get("target_bbox")
        if bbox is None:
            bbox = [0, 0, image.width, image.height]
        target = image.crop(crop_box(bbox, image.width, image.height))
        assets = {}
        for kind, relative, media_type in (("original", original_relative, content_type), ("crop", f"crops/{image_id}.png", "image/png"), ("preview", f"previews/{image_id}.jpg", "image/jpeg")):
            path = safe_path(self.root, relative)
            path.parent.mkdir(parents=True, exist_ok=True)
            if kind == "crop":
                target.save(path, format="PNG", optimize=True)
            elif kind == "preview":
                preview = image.copy()
                preview.thumbnail((480, 360), Image.Resampling.LANCZOS)
                preview.save(path, format="JPEG", quality=82, optimize=True)
            if path.stat().st_size > MAX_BYTES:
                raise DatasetError("Derived asset exceeds64MiB; choose a smaller target crop")
            assets[kind] = {"file_name": relative, "sha256": sha256_file(path), "bytes": path.stat().st_size, "content_type": media_type}
        record = {key: copy.deepcopy(value) for key, value in candidate.items() if key not in {"download_url", "local_file", "expected_sha256", "assets", "revision", "id"}}
        record.update({"id": image_id, "sha256": details["sha256"], "pixel_sha256": details["pixel_sha256"],
                       "phash": details["phash"], "target_phash": details["target_phash"], "target_bbox": bbox,
                       "duplicate_group": "original-" + details["pixel_sha256"], "assets": assets})
        record.setdefault("source", {})["retrieved_at"] = now()
        quality = record.setdefault("quality", {})
        # Keep the collector's judgment separate from the computed result. None
        # records that no explicit visual judgment was supplied on this import.
        visual_sharpness_ok = quality.get("sharpness_ok") if isinstance(quality.get("sharpness_ok"), bool) else None
        quality.update({"original_width": image.width, "original_height": image.height,
                        "sharpness_score": details["sharpness_score"],
                        "visual_sharpness_ok": visual_sharpness_ok,
                        "sharpness_ok": visual_sharpness_ok is not False and details["sharpness_score"] >= SHARPNESS_FLOOR})
        for other in self.rows():
            exact = other.get("pixel_sha256") == record["pixel_sha256"]
            near = hash_distance(other["phash"], record["phash"]) <= NEAR_DUPLICATE_DISTANCE
            target_near = hash_distance(other.get("target_phash", other["phash"]), record["target_phash"]) <= NEAR_DUPLICATE_DISTANCE
            if exact or near or target_near:
                record["duplicate_group"] = other["duplicate_group"]
                record["duplicate_of"] = other["id"]
                break
        reasons = eligibility_errors(record)
        if candidate.get("target_bbox") is None:
            reasons.append("Explicit target crop annotation required")
        if record.get("duplicate_of"):
            reasons.append("Exact/near duplicate requires owner resolution; does not count")
        record["held_reasons"] = reasons
        record["status"] = "held" if reasons else "accepted"
        self.save(record)
        write_json(self.root / "records" / f"{image_id}.json", record)
        return record

    def verify(self, image_id: str, verification: dict) -> dict:
        record = self.get(check_id(image_id))
        if record is None:
            raise DatasetError("Unknown local image")
        record["verification"] = copy.deepcopy(verification)
        reasons = eligibility_errors(record)
        if record.get("duplicate_of"):
            reasons.append("Duplicate remains held pending owner resolution")
        record["held_reasons"] = reasons
        record["status"] = "rejected" if verification.get("decision") == "reject" else ("held" if reasons else "accepted")
        self.save(record)
        write_json(self.root / "records" / f"{image_id}.json", record)
        return record

    def correct(self, image_id: str, patch: dict) -> dict:
        """Regenerate a native crop after explicit edits; acceptance must be renewed."""
        record = self.get(check_id(image_id))
        if record is None:
            raise DatasetError("Unknown local image")
        changes = patch.get("changes")
        reason = patch.get("reason")
        allowed = {"class_id", "variant", "operator_country", "hull", "captured_at", "viewpoint", "condition", "target_bbox", "quality", "rights", "source", "event_group"}
        if not isinstance(changes, dict) or not changes or not isinstance(reason, str) or not reason.strip():
            raise DatasetError("Correction needs changes object and an audit reason")
        if set(changes) - allowed:
            raise DatasetError("Correction contains unsupported fields")
        quality_changes = changes.get("quality", {})
        if not isinstance(quality_changes, dict) or set(quality_changes) - {"subject_length_px", "gsd_m_per_px", "original_resolution", "not_upscaled"}:
            raise DatasetError("Native dimensions/sharpness are measured, not editable")
        previous = {key: copy.deepcopy(record.get(key)) for key in changes}
        for key, value in changes.items():
            if key in {"quality", "rights", "source"}:
                if not isinstance(value, dict):
                    raise DatasetError("Nested correction fields must be objects")
                record.setdefault(key, {}).update(copy.deepcopy(value))
            else:
                record[key] = copy.deepcopy(value)
        check_id(record["class_id"])
        original_asset = record["assets"]["original"]
        original_path = safe_path(self.root, original_asset["file_name"])
        if sha256_file(original_path) != record["sha256"]:
            raise DatasetError("Original checksum mismatch; correction canceled")
        image, _ = open_original(original_path)
        box = crop_box(record.get("target_bbox"), *image.size)
        target = image.crop(box)
        annotation_hash = hashlib.sha256(json.dumps(record["target_bbox"]).encode()).hexdigest()[:16]
        relative = f"crops/{image_id}-{annotation_hash}.png"
        cropped = safe_path(self.root, relative)
        if not cropped.exists():
            target.save(cropped, format="PNG", optimize=True)
        if cropped.stat().st_size > MAX_BYTES:
            raise DatasetError("Corrected crop exceeds64MiB")
        record["assets"]["crop"] = {"file_name": relative, "sha256": sha256_file(cropped), "bytes": cropped.stat().st_size, "content_type": "image/png"}
        score = sharpness(target)
        # Older records do not distinguish visual vetoes from metric failures;
        # preserve a prior failure when its provenance is unknown.
        quality = record["quality"]
        visual_sharpness_ok = quality.get("visual_sharpness_ok", False if quality.get("sharpness_ok") is False else None)
        record["quality"].update({"original_width": image.width, "original_height": image.height,
                                  "sharpness_score": score, "visual_sharpness_ok": visual_sharpness_ok,
                                  "sharpness_ok": visual_sharpness_ok is not False and score >= SHARPNESS_FLOOR})
        record["target_phash"] = phash(target)
        record.pop("verification", None)
        record["status"] = "held"
        record["held_reasons"] = eligibility_errors(record)
        record.setdefault("review_history", []).append({"at": now(), "reason": reason, "previous": previous})
        self.save(record)
        write_json(self.root / "records" / f"{image_id}.json", record)
        return record

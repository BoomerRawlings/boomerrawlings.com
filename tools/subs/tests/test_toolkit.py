from __future__ import annotations

import copy
import hashlib
import http.server
import io
import json
import os
import random
import socketserver
import subprocess
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timezone
from email.utils import format_datetime
from unittest.mock import Mock, patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageDraw, ImageFilter

from subs_dataset.discovery import license_policy
from subs_dataset.__main__ import parser as cli_parser, run as run_cli
from subs_dataset.client import ApiClient
from subs_dataset.io import DatasetError, RateLimitedError, checksum_entries, download, read_jsonl, replace_with_retry, safe_path, sha256_file, write_json
from subs_dataset.loader import batches
from subs_dataset.pipeline import Store, eligibility_errors, inspect
from subs_dataset.releases import choose_release, export_release, split_records, validate_release, validate_splits


def pattern(path: Path, seed: int = 1, size=(1400, 900)):
    rng = random.Random(seed)
    image = Image.new("RGB", size, "#cce0ed")
    draw = ImageDraw.Draw(image)
    for _ in range(100):
        x, y = rng.randrange(size[0]), rng.randrange(size[1])
        w, h = rng.randrange(5, 100), rng.randrange(5, 100)
        draw.rectangle((x, y, min(size[0] - 1, x + w), min(size[1] - 1, y + h)),
                       fill=(rng.randrange(256), rng.randrange(256), rng.randrange(256)))
    draw.text((20, 20), f"SYNTHETIC TEST PATTERN {seed} — NOT A SUBMARINE", fill="black")
    image.save(path)


def candidate(path: Path, class_id="class-a", source="original.jpg"):
    return {"class_id": class_id, "domain": "camera", "local_file": str(path),
            "source": {"page_url": "https://example.org/photos/" + source,
                       "original_url": "https://example.org/originals/" + source, "author": "Test fixture"},
            "rights": {"tier": "commercial", "license": "CC0-1.0", "evidence_url": "https://example.org/test-license",
                       "download_allowed": True, "training_allowed": True, "redistribution_allowed": True,
                       "attribution": "Synthetic test fixture only"},
            "quality": {"subject_length_px": 1000, "original_resolution": True, "not_upscaled": True},
            "target_bbox": [100, 100, 1200, 700], "event_group": "event-" + source,
            "verification": {"collector": "test-collector", "verified_by": "test-verifier",
                             "verified_at": "2026-10-27T12:00:00Z", "decision": "accept",
                             "class_evidence": ["https://example.org/synthetic-only"]}}


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.path = self.root / "original.png"
        pattern(self.path)
        self.store = Store(self.root / "store")

    def tearDown(self):
        self.store.close()
        self.directory.cleanup()

    def test_native_original_crop_and_idempotency(self):
        row = self.store.ingest(candidate(self.path))
        self.assertEqual(row["status"], "accepted", row.get("held_reasons"))
        self.assertEqual(row["quality"]["original_width"], 1400)
        self.assertEqual(row["sha256"], sha256_file(self.path))
        original = self.store.root / row["assets"]["original"]["file_name"]
        self.assertEqual(original.read_bytes(), self.path.read_bytes())
        with Image.open(self.store.root / row["assets"]["crop"]["file_name"]) as crop:
            self.assertEqual(crop.size, (1200, 700))
        again = self.store.ingest(candidate(self.path))
        self.assertTrue(again["unchanged"])
        self.assertEqual(len(self.store.rows()), 1)

    def test_explicit_image_id_survives_encoded_source_ingestion_and_class_correction(self):
        proposal = candidate(self.path, source="Boat_%28Example%29.jpg")
        proposal["id"] = "image-stable-campaign-id"
        self.assertEqual(self.store.discover(proposal), proposal["id"])
        ingested = self.store.ingest(proposal)
        self.assertEqual(ingested["id"], proposal["id"])
        original_asset = ingested["assets"]["original"]
        corrected = self.store.correct(ingested["id"], {"changes": {"class_id": "class-b"}, "reason": "Independent label correction"})
        self.assertEqual(corrected["id"], proposal["id"])
        self.assertEqual(corrected["class_id"], "class-b")
        self.assertEqual(corrected["assets"]["original"], original_asset)
        self.assertEqual(corrected["status"], "held")
        proposal["class_id"] = "class-b"
        repeated = self.store.ingest(proposal)
        self.assertEqual(repeated["id"], proposal["id"])
        self.assertEqual(repeated["class_id"], "class-b")
        self.assertEqual(len(self.store.rows()), 1)

    def test_explicit_id_reassignment_rejected_before_candidate_or_record_mutation(self):
        proposal = candidate(self.path)
        proposal["id"] = "image-protected-id"
        self.store.discover(proposal)
        candidate_before = self.store.db.execute("SELECT data FROM candidates WHERE id=?", (proposal["id"],)).fetchone()[0]
        conflicting = copy.deepcopy(proposal)
        conflicting["source"]["original_url"] = "https://example.org/different-original.jpg"
        with self.assertRaisesRegex(DatasetError, "different source URL"):
            self.store.discover(conflicting)
        self.assertEqual(self.store.db.execute("SELECT data FROM candidates WHERE id=?", (proposal["id"],)).fetchone()[0], candidate_before)
        record = self.store.ingest(proposal)
        saved = (self.store.root / "records" / (proposal["id"] + ".json")).read_bytes()
        with self.assertRaisesRegex(DatasetError, "different source URL"):
            self.store.ingest(conflicting)
        self.assertEqual(self.store.get(proposal["id"]), record)
        self.assertEqual(self.store.db.execute("SELECT data FROM candidates WHERE id=?", (proposal["id"],)).fetchone()[0], candidate_before)
        self.assertEqual((self.store.root / "records" / (proposal["id"] + ".json")).read_bytes(), saved)
        self.store.db.execute("DELETE FROM candidates WHERE id=?", (proposal["id"],))
        self.store.db.commit()
        with self.assertRaisesRegex(DatasetError, "different source URL"):
            self.store.discover(conflicting)
        self.assertEqual(self.store.get(proposal["id"]), record)
        self.assertIsNone(self.store.db.execute("SELECT data FROM candidates WHERE id=?", (proposal["id"],)).fetchone())

    def test_explicit_id_validation_and_legacy_generated_ids(self):
        proposal = candidate(self.path)
        expected = "image-" + hashlib.sha256((proposal["class_id"] + "|" + proposal["source"]["original_url"]).encode()).hexdigest()[:32]
        self.assertEqual(self.store.discover(proposal), expected)
        for invalid in (None, "", "../unsafe", "has spaces"):
            with self.subTest(identifier=invalid), self.assertRaises(DatasetError):
                self.store.discover(proposal | {"id": invalid})
        changed_tracking = copy.deepcopy(proposal)
        changed_tracking["id"] = expected
        changed_tracking["source"]["original_url"] += "?utm_source=review#ignored"
        self.assertEqual(self.store.discover(changed_tracking), expected)

    def test_unicode_source_and_class_text_roundtrips(self):
        record = candidate(self.path)
        record["source"]["author"] = "張三 — Marine française"
        record["rights"]["attribution"] = "Scorpène / 海軍 — photographie autorisée"
        manifest = self.root / "unicode.jsonl"
        manifest.write_text(json.dumps(record, ensure_ascii=False) + "\n", encoding="utf-8-sig")
        result = self.store.ingest(read_jsonl(manifest)[0])
        saved = json.loads((self.store.root / "records" / f"{result['id']}.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["source"]["author"], record["source"]["author"])
        self.assertEqual(saved["rights"]["attribution"], record["rights"]["attribution"])

    def test_thumbnail_corruption_upscale_blur_and_wrong_crop_never_qualify(self):
        thumb = self.root / "thumbnail.png"
        pattern(thumb, size=(500, 300))
        small = candidate(thumb, source="thumb.png")
        small["target_bbox"] = [0, 0, 500, 300]
        small["quality"]["subject_length_px"] = 450
        self.assertEqual(self.store.ingest(small)["status"], "held")
        corrupt = self.root / "broken.jpg"
        corrupt.write_bytes(b"<html>Access denied</html>")
        with self.assertRaises(DatasetError):
            self.store.ingest(candidate(corrupt, source="broken.jpg"))
        upscale = candidate(self.path, source="upscaled.png")
        upscale["quality"]["not_upscaled"] = False
        row = self.store.ingest(upscale)
        self.assertEqual(row["status"], "held")
        self.assertIn("quality.not_upscaled not established", row["held_reasons"])
        blurred = self.root / "blur.png"
        Image.open(self.path).filter(ImageFilter.GaussianBlur(40)).save(blurred)
        self.assertFalse(self.store.ingest(candidate(blurred, source="blur.png"))["quality"]["sharpness_ok"])
        outside = candidate(self.path, source="outside.png")
        outside["target_bbox"] = [1300, 800, 300, 300]
        with self.assertRaises(DatasetError):
            self.store.ingest(outside)

    def test_permission_checked_before_download_and_verifier_independent(self):
        blocked = candidate(Path("does-not-exist"))
        blocked["rights"]["download_allowed"] = False
        self.assertEqual(self.store.ingest(blocked)["status"], "held")
        self.assertEqual(self.store.rows(), [])
        self.assertFalse((self.store.root / "incoming").exists())
        row = candidate(self.path)
        row["verification"]["verified_by"] = "TEST-COLLECTOR"
        result = self.store.ingest(row)
        self.assertEqual(result["status"], "held")
        self.assertTrue(any("independent" in reason for reason in result["held_reasons"]))

    def test_visual_quality_failure_stays_held_despite_high_metric_and_acceptance(self):
        row = candidate(self.path)
        row["quality"]["sharpness_ok"] = False
        self.assertGreater(inspect(self.path, row["target_bbox"])["sharpness_score"], 8)
        result = self.store.ingest(row)
        self.assertGreater(result["quality"]["sharpness_score"], 8)
        self.assertFalse(result["quality"]["sharpness_ok"])
        self.assertIs(result["quality"]["visual_sharpness_ok"], False)
        self.assertEqual(result["status"], "held")
        self.assertIn("quality.sharpness_ok not established", result["held_reasons"])
        corrected = self.store.correct(result["id"], {
            "changes": {"target_bbox": [200, 200, 1000, 500]},
            "reason": "Crop adjustment does not resolve the visual quality failure"})
        self.assertGreater(corrected["quality"]["sharpness_score"], 8)
        self.assertFalse(corrected["quality"]["sharpness_ok"])
        verified = self.store.verify(result["id"], row["verification"])
        self.assertEqual(verified["status"], "held")
        self.assertIn("quality.sharpness_ok not established", eligibility_errors(verified))

    def test_recrop_recovers_metric_only_failure_but_requires_reverification(self):
        # The first annotation mistakenly targets a flat area; the corrected
        # native crop selects fine detail in the same unchanged original.
        image = Image.new("RGB", (1600, 1200), "white")
        draw = ImageDraw.Draw(image)
        for x in range(0, 1600, 20):
            for y in range(600, 1200, 20):
                draw.rectangle((x, y, x + 9, y + 9), fill="black")
        image.save(self.path)
        row = candidate(self.path)
        row["target_bbox"] = [100, 50, 1200, 500]
        self.assertNotIn("sharpness_ok", row["quality"])
        original = self.store.ingest(row)
        self.assertEqual(original["quality"]["sharpness_score"], 0)
        self.assertIsNone(original["quality"]["visual_sharpness_ok"])
        self.assertEqual(original["status"], "held")
        corrected = self.store.correct(original["id"], {
            "changes": {"target_bbox": [100, 650, 1200, 500]},
            "reason": "Move mistakenly placed annotation onto detailed target"})
        self.assertGreater(corrected["quality"]["sharpness_score"], 8)
        self.assertTrue(corrected["quality"]["sharpness_ok"])
        self.assertEqual(corrected["sha256"], original["sha256"])
        self.assertEqual(corrected["status"], "held")
        self.assertNotIn("verification", corrected)
        self.assertEqual(self.store.verify(original["id"], row["verification"])["status"], "accepted")

    def test_legacy_false_with_unknown_review_provenance_stays_failed(self):
        row = candidate(self.path)
        row["quality"]["sharpness_ok"] = False
        legacy = self.store.ingest(row)
        legacy["quality"].pop("visual_sharpness_ok")
        self.store.save(legacy) # Simulate a record written before provenance was stored.
        corrected = self.store.correct(legacy["id"], {
            "changes": {"target_bbox": [200, 200, 1000, 500]},
            "reason": "Correct annotation on legacy original"})
        self.assertGreater(corrected["quality"]["sharpness_score"], 8)
        self.assertIs(corrected["quality"]["visual_sharpness_ok"], False)
        self.assertFalse(corrected["quality"]["sharpness_ok"])
        self.assertEqual(self.store.verify(legacy["id"], row["verification"])["status"], "held")

    def test_recompression_and_pixel_copy_are_not_new_originals(self):
        first = self.store.ingest(candidate(self.path))
        recompressed = self.root / "recompressed.jpg"
        Image.open(self.path).save(recompressed, quality=80)
        second = self.store.ingest(candidate(recompressed, source="recompressed.jpg"))
        self.assertEqual(second["status"], "held")
        self.assertEqual(second["duplicate_of"], first["id"])
        copy_path = self.root / "different-png-compression.png"
        Image.open(self.path).save(copy_path, compress_level=1)
        third = self.store.ingest(candidate(copy_path, source="copy.png"))
        self.assertEqual(third["pixel_sha256"], first["pixel_sha256"])
        self.assertEqual(third["status"], "held")

    def test_satellite_native_resolution_gate(self):
        row = self.store.ingest(candidate(self.path))
        row["domain"] = "satellite"
        row["quality"]["subject_length_px"] = 250
        row["quality"]["gsd_m_per_px"] = 0.5
        self.assertEqual(eligibility_errors(row), [])
        row["quality"]["gsd_m_per_px"] = 10
        self.assertTrue(any("satellite minimum" in item for item in eligibility_errors(row)))

    def test_crop_correction_regenerates_derivative_and_invalidates_acceptance(self):
        original = self.store.ingest(candidate(self.path))
        record = self.store.correct(original["id"], {"changes": {"target_bbox": [200, 200, 800, 400], "quality": {"subject_length_px": 750}}, "reason": "Reviewed annotation correction"})
        self.assertEqual(record["status"], "held")
        self.assertNotIn("verification", record)
        self.assertEqual(record["sha256"], original["sha256"])
        self.assertNotEqual(record["assets"]["crop"]["sha256"], original["assets"]["crop"]["sha256"])
        with Image.open(self.store.root / record["assets"]["crop"]["file_name"]) as image:
            self.assertEqual(image.size, (800, 400))
        with self.assertRaises(DatasetError):
            self.store.correct(record["id"], {"changes": {"quality": {"original_width": 9000}}, "reason": "Invalid fabricated dimensions"})


class DownloadTests(unittest.TestCase):
    def test_429_defers_first_response_and_preserves_resume_bytes(self):
        requests = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.headers.get("Range"))
                self.send_response(429)
                self.send_header("Retry-After", "180")
                self.send_header("Content-Length", "0")
                self.end_headers()

            def log_message(self, *_):
                pass

        with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server, tempfile.TemporaryDirectory() as temporary:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                target = Path(temporary) / "original.jpg"
                partial = target.with_suffix(".jpg.part")
                partial.write_bytes(b"existing-original-prefix")
                resume = target.with_suffix(".jpg.part.json")
                write_json(resume, {"validator": '"same-original"'})
                callback = Mock()
                with patch("subs_dataset.io.time.sleep") as sleep, self.assertRaises(RateLimitedError) as caught:
                    download(f"http://127.0.0.1:{server.server_address[1]}/image", target,
                             allow_localhost=True, retries=9, on_request=callback)
                self.assertIsInstance(caught.exception, DatasetError)
                self.assertEqual(caught.exception.retry_after_seconds, 180)
                self.assertTrue(caught.exception.retry_at.endswith("Z"))
                self.assertEqual(requests, ["bytes=24-"])
                self.assertEqual(callback.call_count, 1)
                sleep.assert_not_called()
                self.assertEqual(partial.read_bytes(), b"existing-original-prefix")
                self.assertEqual(json.loads(resume.read_text(encoding="utf-8")), {"validator": '"same-original"'})
                self.assertFalse(target.exists())
                # A batch must not hammer the same source through the next candidate URL.
                manifest = Path(temporary) / "batch.jsonl"
                rows = [candidate(Path("unused"), source=name) for name in ("one.jpg", "two.jpg")]
                for row in rows:
                    row.pop("local_file")
                    row["download_url"] = f"http://127.0.0.1:{server.server_address[1]}/image"
                manifest.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
                result = run_cli(cli_parser().parse_args(["ingest", str(manifest), "--store", str(Path(temporary) / "store"), "--allow-localhost"]))
                self.assertTrue(result["deferred"])
                self.assertEqual(result["retry_after_seconds"], 180)
                self.assertEqual(result["remaining_candidates"], 1)
                self.assertEqual(result["requests"], 1)
                self.assertEqual(len(requests), 2) # one direct transfer + one batch attempt
            finally:
                server.shutdown()

    def test_retry_after_http_date_and_missing_or_invalid_headers(self):
        current = 1800000000
        future = format_datetime(datetime.fromtimestamp(current + 600, timezone.utc), usegmt=True)
        with patch("subs_dataset.io.time.time", return_value=current):
            deferred = RateLimitedError(future)
            self.assertEqual(deferred.retry_after_seconds, 600)
            self.assertEqual(deferred.retry_at, "2027-01-15T08:10:00Z")
            for header in (None, "", "not-a-date", "-2"):
                self.assertEqual(RateLimitedError(header).retry_after_seconds, 60)
            for header in ("0", format_datetime(datetime.fromtimestamp(current - 60, timezone.utc), usegmt=True)):
                self.assertEqual(RateLimitedError(header).retry_after_seconds, 1)
        with patch("subs_dataset.io.time.time", return_value=current + 0.9):
            self.assertEqual(RateLimitedError("600").retry_at, "2027-01-15T08:10:01Z")

    def test_worker_checksum_schema_is_strict_and_existing_releases_cannot_mix(self):
        digest = "a" * 64
        self.assertEqual(checksum_entries({"algorithm": "sha256", "files": [{"filename": "images.jsonl", "sha256": digest, "bytes": 12}]}), {"images.jsonl": digest})
        for malformed in ({"algorithm": "sha256", "files": []}, {"algorithm": "md5", "files": []}, {"files": [{"filename": "images.jsonl"}]}, {"images.jsonl": "wrong"}):
            with self.assertRaises(DatasetError):
                checksum_entries(malformed)
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            write_json(directory / "release.json", {"id": "older-v1"})
            write_json(directory / "COMPLETE.json", {"release_id": "older-v1"})
            client = ApiClient("http://127.0.0.1:1/subs/api/v1", allow_localhost=True)
            client.request = Mock(return_value={"id": "newer-v2", "status": "provisional"})
            with self.assertRaises(DatasetError):
                client.download_release("newer-v2", directory)
            self.assertEqual(json.loads((directory / "release.json").read_text(encoding="utf-8"))["id"], "older-v1")
            self.assertTrue((directory / "COMPLETE.json").exists())

    def test_transient_sync_lock_retries_atomic_publish(self):
        source = Mock()
        source.replace.side_effect = [PermissionError("sync lock"), PermissionError("sync lock"), None]
        with patch("subs_dataset.io.time.sleep") as sleep:
            replace_with_retry(source, Path("target"))
        self.assertEqual(source.replace.call_count, 3)
        self.assertEqual(sleep.call_count, 2)

    def test_resume_does_not_double_append_and_hash_is_enforced(self):
        body = b"0123456789" * 10000
        seen_ranges = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                offset = 0
                range_header = self.headers.get("Range")
                seen_ranges.append(range_header)
                if range_header:
                    offset = int(range_header.removeprefix("bytes=").removesuffix("-"))
                    self.send_response(206)
                    self.send_header("Content-Range", f"bytes {offset}-{len(body)-1}/{len(body)}")
                else:
                    self.send_response(200)
                self.send_header("Content-Length", str(len(body) - offset))
                self.send_header("ETag", '"same"')
                self.end_headers()
                self.wfile.write(body[offset:])

            def log_message(self, *_):
                pass

        with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server, tempfile.TemporaryDirectory() as temporary:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            root = Path(temporary)
            target = root / "image.bin"
            target.with_suffix(".bin.part").write_bytes(body[:12345])
            write_json(target.with_suffix(".bin.part.json"), {"validator": '"same"'})
            url = f"http://127.0.0.1:{server.server_address[1]}/image"
            expected = hashlib.sha256(body).hexdigest()
            download(url, target, expected_sha256=expected, allow_localhost=True)
            self.assertEqual(target.read_bytes(), body)
            self.assertEqual(seen_ranges, ["bytes=12345-"])
            download(url, target, expected_sha256=expected, allow_localhost=True)
            self.assertEqual(len(seen_ranges), 1)
            with self.assertRaises(DatasetError):
                download(url, root / "wrong.bin", expected_sha256="0" * 64, allow_localhost=True)
            with self.assertRaises(DatasetError):
                download(url, root / "big.bin", max_bytes=12, allow_localhost=True)
            server.shutdown()

    def test_path_traversal_and_private_network_are_rejected(self):
        for relative in ("../escape", "C:/secret", "folder\\secret", "/root", "a/../escape"):
            with self.assertRaises(DatasetError):
                safe_path(Path.cwd(), relative)
        with self.assertRaises(DatasetError):
            download("http://127.0.0.1/private", Path("unused"))


def release_records(count=105):
    rows = []
    for class_id in ("class-a", "class-b"):
        for number in range(count):
            row = candidate(Path("unused"), class_id, f"{class_id}-{number}.jpg")
            row.pop("local_file")
            identity = hashlib.sha256(f"{class_id}-{number}".encode()).hexdigest()
            row.update({"id": f"{class_id}-{number}", "status": "accepted", "sha256": identity,
                        "pixel_sha256": identity, "duplicate_group": "duplicate-" + identity,
                        "event_group": f"event-{class_id}-{number // 3}", "hull": class_id + "-hull-" + str(number % 4)})
            row["quality"].update({"original_width": 1400, "original_height": 900, "sharpness_ok": True})
            rows.append(row)
    classes = [{"id": class_id, "name": class_id, "service": {"status": "commissioned", "as_of": "2026-10-27", "evidence": ["https://example.org/fleet"]}}
               for class_id in ("class-a", "class-b", "scarce-class")]
    return rows, classes


class ReleaseTests(unittest.TestCase):
    def test_balancing_rights_and_capture_components(self):
        rows, classes = release_records()
        rows[0]["rights"]["tier"] = "research"
        selected, included, report = choose_release(rows, classes, "commercial", "camera", "fixture")
        self.assertEqual(len(selected), 208)
        self.assertEqual(report["per_class"], 104)
        self.assertEqual(len(included), 2)
        validate_splits(selected)
        self.assertTrue(all(row["rights"]["tier"] == "commercial" for row in selected))
        with self.assertRaises(DatasetError):
            choose_release(rows, classes, "research", "camera", "fixture")
        for row in rows:
            if row["class_id"] == "class-b":
                row["status"] = "held"
        with self.assertRaises(DatasetError):
            choose_release(rows, classes, "commercial", "camera", "fixture")

    def test_connected_group_bridge_and_immutable_exports(self):
        rows, classes = release_records(100)
        rows[0]["duplicate_group"] = "bridge"
        rows[104]["duplicate_group"] = "bridge"
        selected = split_records(rows, "fixture")
        lookup = {row["id"]: row for row in selected}
        self.assertEqual(lookup[rows[0]["id"]]["split"], lookup[rows[104]["id"]]["split"])
        selected[0]["split"] = "test" if selected[0]["split"] != "test" else "train"
        with self.assertRaises(DatasetError):
            validate_splits(selected)

    def test_export_and_external_process_loader(self):
        rows, classes = release_records(100)
        classes[0]["name"] = "Scorpène / 海軍"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            collection = root / "collection"
            collection.mkdir()
            # Generated diagnostic assets exercise export IO, not recognition accuracy.
            for index, row in enumerate(rows):
                original = collection / f"{row['id']}.png"
                pattern(original, index)
                digest = sha256_file(original)
                cropped = collection / f"{row['id']}-crop.png"
                with Image.open(original) as full:
                    full.crop((100, 100, 1300, 800)).save(cropped)
                row["sha256"] = digest
                row["assets"] = {kind: {"file_name": path.name, "sha256": sha256_file(path), "bytes": path.stat().st_size, "content_type": "image/png"} for kind, path in (("original", original), ("crop", cropped))}
            output = root / "release"
            result = export_release(collection, rows, classes, output, "fixture-v1", "commercial")
            self.assertEqual(result["count"], 200)
            self.assertEqual(len(result["audit_sample"]), 40)
            self.assertTrue(validate_release(output)["valid"])
            self.assertEqual(json.loads((output / "classes.json").read_text(encoding="utf-8"))[0]["name"], "Scorpène / 海軍")
            loaded = sum(len(images) for images, labels in batches(output, split=None))
            self.assertEqual(loaded, 200)
            with self.assertRaises(DatasetError):
                export_release(collection, rows, classes, output, "fixture-v1", "commercial")
            environment = os.environ.copy()
            environment["PYTHONPATH"] = str(Path(__file__).resolve().parents[1])
            command = [sys.executable, "-c", "import sys; from subs_dataset.loader import batches; print(sum(len(x) for x,y in batches(sys.argv[1],split=None)))", str(output)]
            proof = subprocess.run(command, env=environment, check=True, capture_output=True, text=True)
            self.assertEqual(proof.stdout.strip(), "200")
            first = next((output / "crops").iterdir())
            first.write_bytes(b"corrupt")
            with self.assertRaises(DatasetError):
                list(batches(output, split=None))


class DiscoveryTests(unittest.TestCase):
    def test_license_tiers_and_unknown_hold(self):
        def metadata(name):
            return {"LicenseShortName": {"value": name}, "Artist": {"value": "<b>Alice</b>"}}
        self.assertTrue(license_policy(metadata("CC BY-SA 4.0"))["download_allowed"])
        self.assertTrue(license_policy(metadata("Public domain"))["training_allowed"])
        self.assertEqual(license_policy(metadata("CC BY-NC 4.0"))["tier"], "research")
        self.assertFalse(license_policy(metadata("CC BY-ND 4.0"))["download_allowed"])
        self.assertFalse(license_policy(metadata("Unknown"))["download_allowed"])


if __name__ == "__main__":
    unittest.main()

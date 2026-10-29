from __future__ import annotations

import copy
import hashlib
import io
import sys
import tempfile
import unittest
import urllib.error
import urllib.parse
from contextlib import closing
from datetime import datetime, timezone
from email.message import Message
from email.utils import format_datetime
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from subs_dataset.client import ApiClient
from subs_dataset.io import DatasetError, RateLimitedError
from subs_dataset.pipeline import Store


class ClientTests(unittest.TestCase):
    def setUp(self):
        # Transport is mocked throughout; no sockets or credentials are used.
        self.url_check = patch("subs_dataset.client.check_url")
        self.url_check.start()
        self.addCleanup(self.url_check.stop)
        self.client = ApiClient("https://example.org/subs/api/v1")

    def test_selected_ids_chunk_at_fifty_and_allow_privacy_omissions(self):
        ids = [f"image-{number}" for number in range(123)]
        queries = []

        def response(method, path):
            self.assertEqual(method, "GET")
            parsed = urllib.parse.urlsplit(path)
            self.assertEqual(parsed.path, "images")
            query = urllib.parse.parse_qs(parsed.query)
            selected = query["ids"][0].split(",")
            queries.append(selected)
            self.assertEqual(query["offset"], ["0"])
            self.assertEqual(query["limit"], ["50"])
            # An absent or unauthorized record must not trigger a broader lookup.
            visible = [ident for ident in selected if ident != "image-122"]
            return {"items": [{"id": ident} for ident in reversed(visible)], "total": len(visible)}

        self.client.request = Mock(side_effect=response)
        rows = self.client.list_images_by_ids(ids + ids[:2])
        self.assertEqual([len(batch) for batch in queries], [50, 50, 23])
        self.assertEqual([ident for batch in queries for ident in batch], ids)
        self.assertEqual({row["id"] for row in rows}, set(ids) - {"image-122"})
        self.assertEqual(self.client.request.call_count, 3)

    def test_selected_ids_empty_or_invalid_never_requests_entire_collection(self):
        self.client.request = Mock()
        self.assertEqual(self.client.list_images_by_ids([]), [])
        for invalid in (["image-a", ""], ["image-a,b"], [None], "image-a"):
            with self.subTest(invalid=invalid), self.assertRaises(DatasetError):
                self.client.list_images_by_ids(invalid)
        self.client.request.assert_not_called()

    def test_selected_ids_follow_bounded_pagination(self):
        self.client.request = Mock(side_effect=[
            {"items": [{"id": "image-c"}, {"id": "image-a"}], "total": 3},
            {"items": [{"id": "image-b"}], "total": 3},
        ])
        self.assertEqual([row["id"] for row in self.client.list_images_by_ids(["image-a", "image-b", "image-c"])],
                         ["image-c", "image-a", "image-b"])
        queries = [urllib.parse.parse_qs(urllib.parse.urlsplit(call.args[1]).query)
                   for call in self.client.request.call_args_list]
        self.assertEqual([query["offset"] for query in queries], [["0"], ["2"]])
        self.assertTrue(all(query["ids"] == ["image-a,image-b,image-c"] for query in queries))

    def test_selected_ids_reject_wrong_duplicate_and_unbounded_responses(self):
        cases = [
            [{"items": [{"id": "image-other"}], "total": 1}],
            [{"items": [{"id": "image-a"}, {"id": "image-a"}], "total": 2}],
            [{"items": [{"id": "image-a"}], "total": 2}, {"items": [{"id": "image-a"}], "total": 2}],
            [{"items": [], "total": 1000000}],
            [{"items": [], "total": 1}],
            [{"items": "not-a-list", "total": 1}],
        ]
        for pages in cases:
            with self.subTest(pages=pages):
                self.client.request = Mock(side_effect=pages)
                with self.assertRaises(DatasetError):
                    self.client.list_images_by_ids(["image-a", "image-b"])
                self.assertLessEqual(self.client.request.call_count, 2)

    def test_429_and_503_defer_once_without_reading_error_body_or_sleeping(self):
        current = 1800000000
        headers = ["36000", format_datetime(datetime.fromtimestamp(current + 600, timezone.utc), usegmt=True)]
        for code in (429, 503):
            for method in ("GET", "HEAD", "PUT"):
                for retry_after, expected in zip(headers, (36000, 600)):
                    with self.subTest(code=code, method=method, retry_after=retry_after):
                        response_headers = Message()
                        response_headers["Retry-After"] = retry_after
                        response_headers["X-Private"] = "header-secret"
                        body = io.BytesIO(b"untrusted-error-body token-secret")
                        body.read = Mock(wraps=body.read)
                        failure = urllib.error.HTTPError("https://example.org/private?token=secret", code,
                                                         "untrusted-error-detail", response_headers, body)
                        opener = Mock()
                        opener.open.side_effect = failure
                        with patch("subs_dataset.client.urllib.request.build_opener", return_value=opener), \
                                patch("subs_dataset.client.time.sleep") as sleep, \
                                patch("subs_dataset.io.time.time", return_value=current), \
                                self.assertRaises(RateLimitedError) as caught:
                            self.client.request(method, "images?ids=image-a")
                        deferred = caught.exception
                        self.assertEqual(deferred.http_status, code)
                        self.assertEqual(deferred.retry_after_seconds, expected)
                        self.assertEqual(deferred.retry_at, datetime.fromtimestamp(current + expected, timezone.utc)
                                         .isoformat(timespec="seconds").replace("+00:00", "Z"))
                        self.assertIn(f"HTTP {code}", str(deferred))
                        self.assertNotIn("secret", str(deferred))
                        self.assertNotIn("untrusted", str(deferred))
                        opener.open.assert_called_once()
                        body.read.assert_not_called()
                        self.assertTrue(body.closed)
                        sleep.assert_not_called()

    def test_deferred_response_with_missing_or_invalid_retry_after_still_never_retries(self):
        for header in (None, "not-a-date"):
            response_headers = Message()
            if header:
                response_headers["Retry-After"] = header
            opener = Mock()
            opener.open.side_effect = urllib.error.HTTPError("https://example.org", 503, "untrusted", response_headers, io.BytesIO())
            with patch("subs_dataset.client.urllib.request.build_opener", return_value=opener), \
                    patch("subs_dataset.client.time.sleep") as sleep, self.assertRaises(RateLimitedError) as caught:
                self.client.request("GET", "images")
            self.assertEqual(caught.exception.retry_after_seconds, 60)
            opener.open.assert_called_once()
            sleep.assert_not_called()

    def test_sync_selects_records_and_candidates_and_repeated_upload_is_zero(self):
        with tempfile.TemporaryDirectory() as temporary, closing(Store(Path(temporary))) as store:
            assets = {}
            for kind in ("original", "crop", "preview"):
                data = ("synthetic transport fixture " + kind).encode()
                path = store.root / (kind + ".bin")
                path.write_bytes(data)
                assets[kind] = {"file_name": path.name, "sha256": hashlib.sha256(data).hexdigest(),
                                "content_type": "application/octet-stream"}
            record = {"id": "image-reviewed", "class_id": "test-class", "domain": "camera", "status": "held",
                      "sha256": assets["original"]["sha256"], "assets": assets,
                      "source": {"original_url": "https://example.org/original.jpg"},
                      "rights": {"download_allowed": True, "training_allowed": True, "redistribution_allowed": True}}
            candidate = {"id": "image-unreviewed", "class_id": "test-class", "domain": "camera",
                         "source": {"original_url": "https://example.org/unreviewed.jpg"},
                         "rights": {"download_allowed": False, "training_allowed": False, "redistribution_allowed": False}}
            store.save(record)
            store.discover(record)  # The union must not duplicate an ingested candidate ID.
            store.discover(candidate)
            remote = {"image-reviewed": {"id": "image-reviewed", "status": "candidate", "revision": 3}}
            queries, writes = [], []

            def request(method, path, payload=None, *, headers=None, raw=None):
                parsed = urllib.parse.urlsplit(path)
                if method == "GET" and parsed.path == "jobs":
                    return {"items": [{"id": "job-test"}], "total": 1}
                if method == "GET" and parsed.path == "images":
                    selected = urllib.parse.parse_qs(parsed.query)["ids"][0].split(",")
                    self.assertEqual(set(selected), {"image-reviewed", "image-unreviewed"})
                    self.assertEqual(len(selected), 2)
                    queries.append(selected)
                    items = [copy.deepcopy(remote[ident]) for ident in selected if ident in remote]
                    return {"items": items, "total": len(items)}
                self.assertEqual(method, "PUT")
                writes.append((path, copy.deepcopy(payload), copy.deepcopy(headers)))
                parts = path.split("/")
                if len(parts) == 2:
                    prior = remote.get(parts[1])
                    if prior:
                        self.assertEqual(headers, {"If-Match": str(prior["revision"])})
                    remote[parts[1]] = copy.deepcopy(payload) | {"revision": (prior or {}).get("revision", 0) + 1, "assets": {}}
                    return copy.deepcopy(remote[parts[1]])
                self.assertEqual(parts[2], "assets")
                self.assertEqual(hashlib.sha256(raw).hexdigest(), headers["X-Content-SHA256"])
                remote[parts[1]]["assets"][parts[3]] = {"sha256": headers["X-Content-SHA256"]}
                return {}

            self.client.request = Mock(side_effect=request)
            first = self.client.sync(store, "job-test")
            self.assertEqual(first["uploaded_assets"], 3)
            self.assertEqual(first["discovered_candidates"], 1)
            writes_before = len(writes)
            repeated = self.client.sync(store, "job-test")
            self.assertEqual(repeated["uploaded_assets"], 0)
            self.assertEqual(repeated["discovered_candidates"], 0)
            self.assertEqual(len(writes), writes_before)
            self.assertEqual(len(queries), 2)
            self.assertEqual(remote["image-unreviewed"]["rights"], candidate["rights"])
            self.assertTrue(all(row["status"] == "candidate" for row in remote.values()))
            remote["image-reviewed"]["rights"]["training_allowed"] = False
            with self.assertRaises(DatasetError):
                self.client.sync(store, "job-test")
            self.assertEqual(len(writes), writes_before, "Conflicting metadata must not overwrite without explicit correction")

    def test_empty_sync_never_issues_an_image_list(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = Store(Path(temporary))
            try:
                self.client.request = Mock(return_value={"items": [{"id": "job-test"}], "total": 1})
                result = self.client.sync(store, "job-test")
                self.assertEqual(result["records"], 0)
                self.assertEqual(result["uploaded_assets"], 0)
                self.assertEqual(self.client.request.call_count, 1)
                self.assertTrue(self.client.request.call_args.args[1].startswith("jobs?"))
            finally:
                store.close()


if __name__ == "__main__":
    unittest.main()

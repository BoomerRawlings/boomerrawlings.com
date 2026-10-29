from __future__ import annotations

import hashlib
import http.client
import io
import json
import sys
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from subs_dataset.io import (DatasetError, OriginalRedirect, RateLimitedError, RollingBandwidthLimiter,
                             USER_AGENT, download, write_json)

URL = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Fixture.jpg'


class Response:
    def __init__(self, data, *, status=200, headers=None, failure=None):
        self.data, self.status, self.headers, self.url = io.BytesIO(data), status, headers or {}, URL
        self.failure, self.read_sizes = failure, []
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.data.close()
    def read1(self, size):
        self.read_sizes.append(size)
        if self.failure:
            raise self.failure
        return self.data.read(size)


class TransferControlTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.target = Path(self.temp.name) / 'original.jpg'
        self.check_url = patch('subs_dataset.io.check_url')
        self.check_url.start()
        self.addCleanup(self.check_url.stop)
        self.opener = Mock()
        self.open_patch = patch('subs_dataset.io.urllib.request.build_opener', return_value=self.opener)
        self.open_patch.start()
        self.addCleanup(self.open_patch.stop)

    def test_bandwidth_window_is_shared_persisted_and_bounds_receipts(self):
        clock, saved, receipts = [1000.0], [], []
        def sleep(seconds):
            clock[0] += seconds
        limiter = RollingBandwidthLimiter(clock=lambda: clock[0], sleep=sleep, save=lambda rows: saved.append([list(r) for r in rows]))
        for _ in range(100):
            limiter.wait_for(256 * 1024)
            limiter.charge(256 * 1024)
            receipts.append((clock[0], 256 * 1024))
        self.assertGreaterEqual(clock[0], 1010)
        for at, _ in receipts:
            self.assertLessEqual(sum(size for when, size in receipts if at - 10 < when <= at), 20_000_000)
        restored = RollingBandwidthLimiter(saved[-1], clock=lambda: clock[0], sleep=sleep)
        restored.wait_for(20_000_000)
        self.assertGreaterEqual(clock[0], 1020, 'New limiter must honor the persisted previous-file window')
        full = RollingBandwidthLimiter([[1000, 20_000_000]], clock=lambda: 1000, sleep=Mock())
        with patch('subs_dataset.io.time.monotonic', return_value=1000), self.assertRaises(DatasetError):
            full.wait_for(1, deadline=1005)
        full.sleep.assert_not_called()
        for bad in ('', {}, [[1000, -1]], [[float('nan'), 1]]):
            with self.assertRaises(DatasetError):
                RollingBandwidthLimiter(bad)

    def test_commons_uses_stable_contact_and_automatic_limiter(self):
        self.opener.open.return_value = Response(b'abc', headers={'Content-Length': '3'})
        limiter = Mock()
        with patch('subs_dataset.io._COMMONS_BANDWIDTH', limiter):
            download(URL, self.target, retries=0)
        request = self.opener.open.call_args.args[0]
        self.assertEqual(request.get_header('User-agent'), USER_AGENT)
        self.assertIn('https://boomerrawlings.com/', USER_AGENT)
        self.assertIn('Bot/', USER_AGENT)
        limiter.wait_for.assert_called_once_with(3, deadline=None)
        limiter.charge.assert_called_once_with(3)

    def test_resume_206_counts_only_suffix_and_cached_file_makes_no_request(self):
        self.target.with_suffix('.jpg.part').write_bytes(b'abc')
        write_json(self.target.with_suffix('.jpg.part.json'), {'validator': '"same"'})
        self.opener.open.return_value = Response(b'def', status=206, headers={'Content-Range': 'bytes 3-5/6', 'Content-Length': '3'})
        charges, request = [], Mock()
        checksum = hashlib.sha256(b'abcdef').hexdigest()
        download(URL, self.target, expected_sha256=checksum, max_transfer_bytes=3, on_bytes=charges.append, on_request=request)
        self.assertEqual(charges, [3])
        self.assertEqual(self.target.read_bytes(), b'abcdef')
        self.assertEqual(self.opener.open.call_args.args[0].get_header('Range'), 'bytes=3-')
        download(URL, self.target, expected_sha256=checksum, max_transfer_bytes=0, on_bytes=charges.append, on_request=request)
        self.assertEqual(charges, [3])
        request.assert_called_once()
        self.opener.open.assert_called_once()

    def test_ignored_range_counts_entire_replacement(self):
        self.target.with_suffix('.jpg.part').write_bytes(b'old-prefix')
        self.opener.open.return_value = Response(b'new-body', headers={'Content-Length': '8'})
        charges = []
        download(URL, self.target, retries=0, max_transfer_bytes=8, on_bytes=charges.append)
        self.assertEqual(sum(charges), 8)
        self.assertEqual(self.target.read_bytes(), b'new-body')

    def test_failed_read_preserves_and_charges_partial_even_without_length(self):
        for partial in (b'abc', b''):
            with self.subTest(partial=partial):
                target = self.target.with_name('partial-' + str(len(partial)) + '.jpg')
                self.opener.open.return_value = Response(b'', failure=http.client.IncompleteRead(partial))
                charges = []
                with self.assertRaises(DatasetError):
                    download(URL, target, retries=0, on_bytes=charges.append)
                self.assertEqual(sum(charges), len(partial))
                self.assertFalse(target.exists())
                self.assertEqual(target.with_suffix('.jpg.part').read_bytes(), partial)

    def test_unknown_length_cannot_read_past_batch_remaining_budget(self):
        response = Response(b'abcdefghij')
        self.opener.open.return_value = response
        charges = []
        with self.assertRaises(DatasetError):
            download(URL, self.target, retries=0, max_transfer_bytes=5, on_bytes=charges.append)
        self.assertEqual(sum(charges), 5)
        self.assertEqual(response.read_sizes, [5])
        self.assertEqual(self.target.with_suffix('.jpg.part').read_bytes(), b'abcde')
        self.assertFalse(self.target.exists())

    def test_429_503_preserve_partial_and_defer_without_retry_or_body_read(self):
        for status in (429, 503):
            with self.subTest(status=status):
                partial = self.target.with_suffix('.jpg.part')
                partial.write_bytes(b'prefix')
                meta = self.target.with_suffix('.jpg.part.json')
                write_json(meta, {'validator': '"same"'})
                body = io.BytesIO(b'private untrusted body')
                body.read = Mock(wraps=body.read)
                self.opener.open.reset_mock()
                self.opener.open.side_effect = urllib.error.HTTPError(URL, status, 'untrusted', {'Retry-After': '600'}, body)
                charges = []
                with patch('subs_dataset.io.time.sleep') as sleep, self.assertRaises(RateLimitedError) as caught:
                    download(URL, self.target, retries=9, on_bytes=charges.append)
                self.assertEqual(caught.exception.http_status, status)
                self.assertEqual(caught.exception.retry_after_seconds, 600)
                self.assertIn(f'HTTP {status}', str(caught.exception))
                self.opener.open.assert_called_once()
                sleep.assert_not_called()
                body.read.assert_not_called()
                self.assertTrue(body.closed)
                self.assertEqual(charges, [])
                self.assertEqual(partial.read_bytes(), b'prefix')
                self.assertEqual(json.loads(meta.read_text()), {'validator': '"same"'})

    def test_expired_deadline_prevents_request_and_commons_redirect_is_refused(self):
        with patch('subs_dataset.io.time.monotonic', return_value=600), self.assertRaises(DatasetError):
            download(URL, self.target, deadline=600)
        self.opener.open.assert_not_called()
        redirect = OriginalRedirect(False, None)
        for old, new in ((URL, 'https://example.org/other'), ('https://example.org/other', URL)):
            with self.assertRaises(DatasetError):
                redirect.redirect_request(urllib.request.Request(old), None, 302, 'Moved', {}, new)


if __name__ == '__main__':
    unittest.main()

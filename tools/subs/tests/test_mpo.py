"""Synthetic camera-container fixtures only; no downloaded photographs in tests."""

from __future__ import annotations

import copy
import io
import json
import struct
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageOps, JpegImagePlugin

from subs_dataset.image_decode import MPO_POLICY, decode_original
from subs_dataset.io import DatasetError, read_jsonl, sha256_file, write_json, write_jsonl
from subs_dataset.loader import batches
from subs_dataset.pipeline import Store, inspect
from subs_dataset.releases import export_release, validate_release
from test_toolkit import candidate, pattern


def jpeg_bytes(image, orientation=1):
    out = io.BytesIO()
    exif = Image.Exif()
    exif[274] = orientation
    image.save(out, "JPEG", quality=90, exif=exif)
    return out.getvalue()


def synthetic_mpo(path, *, thumbnails=1, orientation=1, mutate=None, thumb_image=None, version=b"0100", endian="<"):
    """Write a real MPF index and independent JPEG streams, with injectable faults."""
    pattern(path.with_suffix(".png"))
    with Image.open(path.with_suffix(".png")) as image:
        original = jpeg_bytes(image, orientation)
        thumb = thumb_image or image.resize((600, 386), Image.Resampling.LANCZOS)
        auxiliaries = [jpeg_bytes(thumb, orientation)]
        if thumbnails == 2:
            auxiliaries.append(jpeg_bytes(image.resize((300, 193), Image.Resampling.LANCZOS), orientation))
    count = thumbnails + 1
    # SOI + APP2 marker/length + "MPF\0" places the TIFF origin at byte10.
    mpbase, entries_offset = 10, 50
    payload_length = 4 + entries_offset + 16 * count
    header_length = payload_length + 4
    entries = [{"attribute": 0xA0030000, "size": len(original) + header_length,
                "offset": 0, "dep1": 2, "dep2": 3 if count == 3 else 0}]
    position = entries[0]["size"]
    for index, data in enumerate(auxiliaries):
        entries.append({"attribute": 0x40010001, "size": len(data), "offset": position - mpbase,
                        "dep1": 0, "dep2": 0})
        position += len(data)
    if mutate:
        mutate(entries)
    tiff = ((b"II\x2a\0" if endian == "<" else b"MM\0\x2a") + struct.pack(endian + "I", 8) + struct.pack(endian + "H", 3)
            + struct.pack(endian + "HHI", 0xB000, 7, 4) + version
            + struct.pack(endian + "HHII", 0xB001, 4, 1, count)
            + struct.pack(endian + "HHII", 0xB002, 7, 16 * count, entries_offset)
            + b"\0" * 4
            + b"".join(struct.pack(endian + "IIIHH", e["attribute"], e["size"], e["offset"], e["dep1"], e["dep2"])
                       for e in entries))
    payload = b"MPF\0" + tiff
    app2 = b"\xff\xe2" + struct.pack(">H", len(payload) + 2) + payload
    path.write_bytes(original[:2] + app2 + original[2:] + b"".join(auxiliaries))
    return original, entries


class MpoTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / "camera.jpg"

    def test_valid_two_and_three_entries_match_primary_pixels_and_preserve_bytes(self):
        for number in (1, 2):
            with self.subTest(thumbnails=number):
                primary, _ = synthetic_mpo(self.path, thumbnails=number)
                before = self.path.read_bytes()
                image, fmt, selection = decode_original(self.path)
                with Image.open(io.BytesIO(primary)) as expected:
                    self.assertEqual(image.tobytes(), expected.convert("RGB").tobytes())
                self.assertEqual(fmt, "MPO")
                self.assertEqual(selection, {"container": "MPO", "primary_frame": 0,
                                             "frame_count": number + 1, "policy": MPO_POLICY})
                self.assertEqual(self.path.read_bytes(), before)
                self.assertEqual(inspect(self.path)["original_decoding"], selection)

    def test_container_rejects_ambiguous_types_dependencies_ranges_and_corruption(self):
        mutations = {
            "second-primary": lambda e: e[1].update(attribute=0x40030000),
            "stereo": lambda e: e[1].update(attribute=0x40020002),
            "unknown-type": lambda e: e[1].update(attribute=0x40010005),
            "representative-child": lambda e: e[1].update(attribute=0x60010001),
            "non-dependent-child": lambda e: e[1].update(attribute=0x00010001),
            "bad-primary-reference": lambda e: e[0].update(dep1=1),
            "child-reference": lambda e: e[1].update(dep1=1),
            "stale-offset": lambda e: e[1].update(offset=e[1]["offset"] + 1),
            "overlap": lambda e: e[1].update(offset=1),
            "oversized-range": lambda e: e[1].update(size=100_000_000),
            "short-primary": lambda e: e[0].update(size=e[0]["size"] - 2),
            "nonzero-primary-offset": lambda e: e[0].update(offset=1),
        }
        for name, mutate in mutations.items():
            with self.subTest(fault=name):
                synthetic_mpo(self.path, mutate=mutate)
                with self.assertRaises(DatasetError):
                    decode_original(self.path)
        synthetic_mpo(self.path)
        self.path.write_bytes(self.path.read_bytes()[:-2])
        with self.assertRaises(DatasetError):
            decode_original(self.path)

    def test_fullsize_or_different_scene_thumbnail_and_extra_unindexed_photo_rejected(self):
        for image in (Image.new("RGB", (1400, 900), "white"), Image.new("RGB", (600, 386), "black")):
            synthetic_mpo(self.path, thumb_image=image)
            with self.assertRaises(DatasetError):
                decode_original(self.path)
        primary, _ = synthetic_mpo(self.path)
        self.path.write_bytes(self.path.read_bytes() + primary)
        with self.assertRaises(DatasetError):
            decode_original(self.path)

    def test_plain_jpeg_and_mpo_pixel_limit_is_checked_before_pixel_loading(self):
        primary, _ = synthetic_mpo(self.path)
        plain = self.root / "plain.jpg"
        plain.write_bytes(primary)
        for source in (plain, self.path):
            with self.subTest(source=source.name), patch.object(Image, "MAX_IMAGE_PIXELS", 100), \
                    patch.object(JpegImagePlugin.JpegImageFile, "load", side_effect=AssertionError("pixel load before limit")):
                with self.assertRaisesRegex(DatasetError, "large.*dimensions"):
                    decode_original(source)
        _, entries = synthetic_mpo(self.path)
        data = bytearray(self.path.read_bytes())
        auxiliary_start = entries[1]["offset"] + 10
        sof = data.find(b"\xff\xc0", auxiliary_start)
        self.assertGreater(sof, auxiliary_start)
        struct.pack_into(">HH", data, sof + 5, 3000, 3000)
        self.path.write_bytes(data)
        original_load = JpegImagePlugin.JpegImageFile.load

        def guarded_load(image):
            if image.size == (3000, 3000):
                raise AssertionError("auxiliary pixels loaded before limit")
            return original_load(image)

        with patch.object(Image, "MAX_IMAGE_PIXELS", 2_000_000), \
                patch.object(JpegImagePlugin.JpegImageFile, "load", guarded_load):
            with self.assertRaisesRegex(DatasetError, "large.*dimensions"):
                decode_original(self.path)

    def test_malformed_mpf_never_downgrades_to_plain_jpeg(self):
        synthetic_mpo(self.path, version=b"9999")
        with self.assertRaises(DatasetError):
            decode_original(self.path)

    def test_big_endian_index_supported_but_declared_count_and_typed_selection_are_strict(self):
        synthetic_mpo(self.path, endian=">")
        image, _, selection = decode_original(self.path)
        self.assertEqual(image.size, (1400, 900))
        bad = dict(selection, primary_frame=False)
        with self.assertRaises(DatasetError):
            decode_original(self.path, expected_decoding=bad)
        for count in (1, 4, 0xFFFFFFFF):
            synthetic_mpo(self.path)
            data = bytearray(self.path.read_bytes())
            struct.pack_into("<I", data, 40, count)
            self.path.write_bytes(data)
            with self.assertRaises(DatasetError):
                decode_original(self.path)
        synthetic_mpo(self.path)
        data = bytearray(self.path.read_bytes())
        data[14:18] = struct.pack("<I", 0xFFFFFF00)  # corrupt TIFF IFD offset
        self.path.write_bytes(data)
        with self.assertRaises(DatasetError):
            decode_original(self.path)

    def test_ingest_one_original_duplicate_pixels_and_independent_quality_gates(self):
        primary, _ = synthetic_mpo(self.path)
        before = self.path.read_bytes()
        with closing(Store(self.root / "store")) as store:
            proposal = candidate(self.path)
            proposal["original_decoding"] = {"primary_frame": 99}  # never trusted
            record = store.ingest(proposal)
            self.assertEqual(record["status"], "accepted", record.get("held_reasons"))
            self.assertEqual(record["original_decoding"]["primary_frame"], 0)
            original = store.root / record["assets"]["original"]["file_name"]
            self.assertEqual(original.read_bytes(), before)
            self.assertEqual(record["sha256"], sha256_file(self.path))
            self.assertTrue(store.ingest(proposal)["unchanged"])
            self.assertEqual(len(store.rows()), 1)
            extracted = self.root / "plain.jpg"
            extracted.write_bytes(primary)
            duplicate = store.ingest(candidate(extracted, source="plain.jpg"))
            self.assertEqual(duplicate["status"], "held")
            self.assertEqual(duplicate["pixel_sha256"], record["pixel_sha256"])
        with closing(Store(self.root / "held-store")) as store:
            proposal = candidate(self.path)
            proposal["quality"]["original_resolution"] = False
            proposal["quality"]["sharpness_ok"] = False
            proposal.pop("verification")
            record = store.ingest(proposal)
            self.assertEqual(record["status"], "held")
            self.assertFalse(record["quality"]["original_resolution"])
            self.assertFalse(record["quality"]["sharpness_ok"])

    def _release(self, orientation=1):
        primary, _ = synthetic_mpo(self.path, orientation=orientation)
        store = Store(self.root / "store")
        self.addCleanup(store.close)
        proposal = candidate(self.path)
        if orientation == 6:
            proposal["target_bbox"] = [50, 80, 800, 1200]
        record = store.ingest(proposal)
        self.assertEqual(record["status"], "accepted", record.get("held_reasons"))
        row = copy.deepcopy(record) | {"split": "train"}
        release = self.root / "release"
        # Balancing is already covered separately; exercise the actual export with
        # one small synthetic record, without manufacturing200 photographs here.
        with patch("subs_dataset.releases.choose_release", return_value=([row], [], {})):
            export_release(store.root, [row], [], release, "mpo-fixture", "commercial")
        return store, record, release, primary

    def test_rotated_primary_crops_export_validation_loader_and_byte_checksums_agree(self):
        store, record, release, primary = self._release(orientation=6)
        self.assertEqual((record["quality"]["original_width"], record["quality"]["original_height"]), (900, 1400))
        self.assertTrue(validate_release(release)["valid"])
        loaded, labels = next(batches(release, view="original"))
        with Image.open(io.BytesIO(primary)) as expected:
            self.assertEqual(loaded[0].tobytes(), ImageOps.exif_transpose(expected).convert("RGB").tobytes())
        self.assertEqual(labels, ["class-a"])
        crops, _ = next(batches(release))
        self.assertEqual(crops[0].size, (800, 1200))
        original = release / record["assets"]["original"]["file_name"]
        self.assertEqual(original.read_bytes(), self.path.read_bytes())
        corrected = store.correct(record["id"], {"changes": {"target_bbox": [80, 100, 700, 1100]}, "reason": "Synthetic test"})
        self.assertEqual(corrected["status"], "held")
        self.assertEqual(corrected["assets"]["original"], record["assets"]["original"])

    @staticmethod
    def _refresh_metadata_checksums(release):
        checksums = json.loads((release / "checksums.json").read_text())
        checksums["images.jsonl"] = sha256_file(release / "images.jsonl")
        write_json(release / "checksums.json", checksums)
        marker = json.loads((release / "COMPLETE.json").read_text())
        marker.update(images_sha256=sha256_file(release / "images.jsonl"), checksums_sha256=sha256_file(release / "checksums.json"))
        write_json(release / "COMPLETE.json", marker)

    def test_manifest_requires_measured_selection_even_if_loader_checksum_skip_requested(self):
        _, _, release, _ = self._release()
        rows = read_jsonl(release / "images.jsonl")
        for value in (None, {"container": "MPO", "primary_frame": 1, "frame_count": 2, "policy": MPO_POLICY}):
            if value is None:
                rows[0].pop("original_decoding", None)
            else:
                rows[0]["original_decoding"] = value
            write_jsonl(release / "images.jsonl", rows)
            self._refresh_metadata_checksums(release)
            with self.assertRaises(DatasetError):
                validate_release(release)
            with self.assertRaises(DatasetError):
                next(batches(release, view="original", verify=False))


if __name__ == "__main__":
    unittest.main()

"""One photograph per original; narrowly validated MPF thumbnails are not scenes."""

from __future__ import annotations

import io
import struct
import warnings
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, ImageStat, JpegImagePlugin, UnidentifiedImageError

from .io import DatasetError, MAX_BYTES

MAX_PIXELS = 80_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
FORMATS = {"JPEG": ("jpg", "image/jpeg"), "PNG": ("png", "image/png"),
           "WEBP": ("webp", "image/webp"), "TIFF": ("tif", "image/tiff"),
           "MPO": ("jpg", "image/jpeg")}
MPO_POLICY = "mpf-primary-thumbnails-v1"
THUMBNAIL_TYPES = {"Large Thumbnail (VGA Equivalent)": (480, 640),
                   "Large Thumbnail (Full HD Equivalent)": (1080, 1920)}


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise DatasetError("Unsupported or corrupt MPO: " + message)


def _check_dimensions(image: Image.Image) -> None:
    # JpegImageFile's direct constructor does not run Image.open's bomb check.
    limit = min(MAX_PIXELS, Image.MAX_IMAGE_PIXELS or MAX_PIXELS)
    if image.width < 1 or image.height < 1 or image.width * image.height > limit:
        raise DatasetError("Invalid or excessively large original image dimensions")


def _jpeg_structure(data: bytes) -> list[int]:
    """Validate the exact JPEG extent, skipping metadata and stuffed entropy bytes."""
    _require(data.startswith(b"\xff\xd8"), "missing JPEG start")
    pos, entropy, mpf_bases = 2, False, []
    while pos < len(data):
        if entropy:
            pos = data.find(b"\xff", pos)
            _require(pos >= 0, "missing JPEG end")
        _require(pos + 1 < len(data) and data[pos] == 0xFF, "invalid JPEG marker")
        while pos < len(data) and data[pos] == 0xFF:
            pos += 1
        _require(pos < len(data), "truncated JPEG marker")
        marker = data[pos]
        pos += 1
        if entropy and (marker == 0 or 0xD0 <= marker <= 0xD7):
            continue
        if marker == 0xD9:
            _require(pos == len(data), "declared JPEG size differs from actual end")
            return mpf_bases
        _require(marker not in {0, 0xD8} and not 0xD0 <= marker <= 0xD7, "unexpected JPEG marker")
        if marker == 1:  # TEM has no length.
            continue
        _require(pos + 2 <= len(data), "truncated JPEG segment")
        length = int.from_bytes(data[pos:pos + 2], "big")
        _require(length >= 2 and pos + length <= len(data), "invalid JPEG segment length")
        if marker == 0xE2 and data[pos + 2:pos + 6] == b"MPF\0":
            mpf_bases.append(pos + 6)
        pos += length
        entropy = marker == 0xDA
    raise DatasetError("Unsupported or corrupt MPO: missing JPEG end")


def _mpo_primary(path: Path, header: JpegImagePlugin.JpegImageFile) -> tuple[Image.Image, dict]:
    # Pillow's generic Image.open may downgrade malformed MPF to JPEG. Inspect the
    # JPEG header directly and never fall back when an MPF marker is present.
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", UserWarning)
            mp = header._getmp()
        base = header.info["mpoffset"]
        count, entries = mp[0xB001], mp[0xB002]
    except (KeyError, TypeError, ValueError, SyntaxError, IndexError, UserWarning, struct.error) as exc:
        raise DatasetError("Unsupported or corrupt MPO: malformed MPF index") from exc
    _require(type(count) is int and count in (2, 3) and len(entries) == count, "expected primary plus one/two thumbnails")
    _require(mp.get(0xB000) == b"0100", "unsupported MPF version")
    raw = path.read_bytes()
    primary, primary_orientation, previous_end = None, None, 0
    for index, entry in enumerate(entries):
        attr = entry["Attribute"]
        _require(attr["ImageDataFormat"] == "JPEG" and attr["Reserved"] == 0, "unknown image attributes")
        if index == 0:
            _require(attr["MPType"] == "Baseline MP Primary Image" and entry["DataOffset"] == 0,
                     "first entry must be the unique primary at offset zero")
            _require(attr["DependentParentImageFlag"] and not attr["DependentChildImageFlag"], "invalid primary dependencies")
            dependencies = [entry[key] for key in ("EntryNo1", "EntryNo2") if entry[key]]
            _require(sorted(dependencies) == list(range(2, count + 1)), "primary must reference each thumbnail once")
            start = 0
        else:
            _require(attr["MPType"] in THUMBNAIL_TYPES and attr["DependentChildImageFlag"]
                     and not attr["DependentParentImageFlag"] and not attr["RepresentativeImageFlag"],
                     "additional entries must be dependent thumbnails")
            _require(entry["EntryNo1"] == entry["EntryNo2"] == 0, "invalid thumbnail dependencies")
            start = base + entry["DataOffset"]
        size = entry["Size"]
        _require(type(start) is int and type(size) is int and size > 4 and start >= previous_end
                 and start + size <= len(raw), "invalid, overlapping, or stale image range")
        gap = raw[previous_end:start]
        _require(len(gap) <= 4096 and b"\xff\xd8\xff" not in gap, "unindexed image or excessive inter-frame data")
        chunk = raw[start:start + size]
        markers = _jpeg_structure(chunk)
        _require(markers == [base] if index == 0 else not markers, "missing, repeated, or nested MPF index")
        # Decode the validated range, not an offset discovered by scanning for SOI.
        with JpegImagePlugin.JpegImageFile(io.BytesIO(chunk)) as frame:
            _check_dimensions(frame)
            orientation = frame.getexif().get(274)
            if index:
                limits = THUMBNAIL_TYPES[attr["MPType"]]
                _require(all(a <= b for a, b in zip(sorted(frame.size), limits))
                         and frame.width < primary.width and frame.height < primary.height,
                         "auxiliary image is not a smaller bounded thumbnail")
                _require(abs(frame.width / frame.height - primary.width / primary.height)
                         <= 0.01 * primary.width / primary.height, "thumbnail aspect ratio disagrees with primary")
                _require(orientation in (None, primary_orientation), "thumbnail orientation disagrees with primary")
            frame.load()
            if index == 0:
                primary, primary_orientation = frame.copy(), orientation
            else:
                # Metadata labels alone cannot turn a different scene into a thumbnail.
                small = frame.convert("RGB").resize((96, 96), Image.Resampling.LANCZOS)
                reference = primary.convert("RGB").resize((96, 96), Image.Resampling.LANCZOS)
                difference = ImageStat.Stat(ImageChops.difference(reference, small))
                _require(sum(difference.mean) / 3 <= 12 and max(difference.rms) <= 25,
                         "dependent thumbnail does not match the primary scene")
        previous_end = start + size
    tail = raw[previous_end:]
    _require(len(tail) <= 4096 and b"\xff\xd8\xff" not in tail, "unindexed image or excessive trailing data")
    return primary, {"container": "MPO", "primary_frame": 0, "frame_count": count, "policy": MPO_POLICY}


def decode_original(path: Path, *, expected_decoding: dict | None = None,
                    require_declared: bool = False) -> tuple[Image.Image, str, dict | None]:
    """Return oriented RGB, container, and measured scene policy; never rewrite bytes."""
    if path.stat().st_size > MAX_BYTES:
        raise DatasetError("Original exceeds64MiB limit")
    if expected_decoding is not None and (not isinstance(expected_decoding, dict)
            or type(expected_decoding.get("primary_frame")) is not int
            or type(expected_decoding.get("frame_count")) is not int):
        raise DatasetError("Invalid original decoding metadata")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with path.open("rb") as stream:
                jpeg = stream.read(2) == b"\xff\xd8"
            opener = JpegImagePlugin.JpegImageFile if jpeg else Image.open
            with opener(path) as source:
                _check_dimensions(source)
                image_format, decoding = source.format, None
                if jpeg and "mp" in source.info:
                    frame, decoding = _mpo_primary(path, source)
                    image_format = "MPO"
                else:
                    if image_format not in FORMATS:
                        raise DatasetError("Only JPEG, PNG, WebP, TIFF, or validated thumbnail-only MPO originals are supported")
                    if getattr(source, "n_frames", 1) != 1:
                        raise DatasetError("Animated/multi-page images need an explicitly selected original scene")
                    source.load()
                    frame = source.copy()
                if expected_decoding is not None and expected_decoding != decoding:
                    raise DatasetError("Original decoding metadata disagrees with measured container")
                if require_declared and decoding is not None and expected_decoding is None:
                    raise DatasetError("MPO original requires explicit original_decoding metadata")
                oriented = ImageOps.exif_transpose(frame)
                if "A" in oriented.getbands():
                    image = Image.new("RGB", oriented.size, "white")
                    image.paste(oriented, mask=oriented.getchannel("A"))
                else:
                    image = oriented.convert("RGB")
                return image, image_format, decoding
    except (UnidentifiedImageError, OSError, SyntaxError, KeyError, IndexError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise DatasetError("Invalid, corrupt, or excessively large original image") from exc

"""Portable image/class-label batches. No source captions or hull IDs enter model inputs."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from .io import DatasetError, read_jsonl, safe_path, sha256_file
from .releases import require_complete


def batches(path: str | Path, *, split: str | None = "train", batch_size: int = 32,
            view: str = "crop", verify: bool = True):
    """Yield (list[PIL RGB image], list[str class_id]); caller chooses model preprocessing."""
    root = Path(path)
    completion = require_complete(root)
    if view not in completion.get("views", ["original", "crop"]):
        raise DatasetError("Requested view was not downloaded; resume download with original assets enabled")
    if batch_size < 1 or view not in {"original", "crop"}:
        raise DatasetError("Invalid batch size or requested view")
    images, labels = [], []
    for record in read_jsonl(root / "images.jsonl"):
        if split is not None and record.get("split") != split:
            continue
        asset = record["assets"][view]
        image_path = safe_path(root, asset["file_name"])
        if verify and sha256_file(image_path) != asset["sha256"]:
            raise DatasetError("Image bytes do not match the release checksum")
        with Image.open(image_path) as original:
            original.load()
            images.append(ImageOps.exif_transpose(original).convert("RGB"))
        labels.append(record["class_id"])
        if len(images) == batch_size:
            yield images, labels
            images, labels = [], []
    if images:
        yield images, labels

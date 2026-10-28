"""Balanced, immutable, rights-separated releases and image/label loading."""

from __future__ import annotations

import copy
import hashlib
import json
import math
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageOps

from .io import DatasetError, checksum_entries, read_jsonl, safe_path, sha256_file, write_json, write_jsonl
from .pipeline import check_id, crop_box, eligibility_errors, evidence_url, now, open_original


def group_components(records: list[dict]) -> list[list[dict]]:
    """Connected components, not just one group key: aliases cannot bridge split boundaries."""
    parent = list(range(len(records)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left, right):
        parent[find(right)] = find(left)

    seen = {}
    for index, record in enumerate(records):
        for field in ("sha256", "pixel_sha256", "duplicate_group", "event_group"):
            value = record.get(field)
            if value:
                key = (field, value)
                if key in seen:
                    union(index, seen[key])
                else:
                    seen[key] = index
    groups = defaultdict(list)
    for index, record in enumerate(records):
        groups[find(index)].append(record)
    return list(groups.values())


def split_records(records: list[dict], seed: str) -> list[dict]:
    rng = random.Random(seed)
    groups = group_components(records)
    rng.shuffle(groups)
    groups.sort(key=len, reverse=True)
    totals = Counter(record["class_id"] for record in records)
    ratios = {"train": 0.8, "validation": 0.1, "test": 0.1}
    counts = {split: Counter() for split in ratios}
    output = []
    for group in groups:
        additions = Counter(record["class_id"] for record in group)
        # Minimize per-class squared distance to desired counts. Groups stay indivisible.
        def score(split):
            return sum(((counts[split][class_id] + number - totals[class_id] * ratios[split]) ** 2
                        - (counts[split][class_id] - totals[class_id] * ratios[split]) ** 2)
                       / max(1, totals[class_id] * ratios[split]) for class_id, number in additions.items())
        chosen = min(ratios, key=score)
        counts[chosen].update(additions)
        output.extend(copy.deepcopy(record) | {"split": chosen} for record in group)
    return sorted(output, key=lambda record: (record["class_id"], record["id"]))


def validate_splits(records: list[dict]) -> None:
    for group in group_components(records):
        if len({record.get("split") for record in group}) != 1:
            raise DatasetError("Duplicate/capture-event group crosses dataset splits")


def choose_release(records: list[dict], classes: list[dict], rights_tier: str, domain: str,
                   seed: str) -> tuple[list[dict], list[dict], dict]:
    if rights_tier not in {"commercial", "research"} or domain not in {"camera", "satellite"}:
        raise DatasetError("Invalid rights tier or image domain")
    known = {}
    for entry in classes:
        service = entry.get("service", {})
        evidence = service.get("evidence", [])
        if (service.get("status") == "commissioned" and service.get("as_of")
                and evidence and all(evidence_url(url) for url in evidence)):
            known[entry["id"]] = entry
    by_class = defaultdict(list)
    excluded = Counter()
    seen_hashes = set()
    for record in sorted(records, key=lambda row: row["id"]):
        if record.get("domain") != domain or record.get("rights", {}).get("tier") != rights_tier:
            continue
        if record.get("status") != "accepted" or eligibility_errors(record) or record.get("duplicate_of"):
            excluded["not_eligible"] += 1
            continue
        if record["class_id"] not in known:
            excluded["class_not_in_verified_snapshot"] += 1
            continue
        identities = {("sha256", record.get("sha256")), ("pixel_sha256", record.get("pixel_sha256"))}
        identities = {identity for identity in identities if identity[1]}
        if not identities or any(identity in seen_hashes for identity in identities):
            excluded["duplicate"] += 1
            continue
        seen_hashes.update(identities)
        by_class[record["class_id"]].append(record)
    minimum = 100 if domain == "camera" else 1
    eligible = {class_id: rows for class_id, rows in by_class.items() if len(rows) >= minimum}
    if len(eligible) < 2:
        raise DatasetError(f"Release needs >=2 classes with >={minimum} eligible {domain} originals in this rights tier")
    size = min(len(rows) for rows in eligible.values())
    if domain == "camera":
        size = min(400, size)
    # Round-robin event groups improves variety without pretending independent exposures are duplicates.
    selected = []
    rng = random.Random(seed)
    for class_id, rows in sorted(eligible.items()):
        groups = group_components(rows)
        rng.shuffle(groups)
        for group in groups:
            rng.shuffle(group)
        chosen = []
        while len(chosen) < size:
            for group in groups:
                if group:
                    chosen.append(group.pop())
                    if len(chosen) == size:
                        break
        selected.extend(chosen)
    selected = split_records(selected, seed)
    validate_splits(selected)
    coverage = {"goal_per_class": 400 if domain == "camera" else None, "domain": domain,
                "rights_tier": rights_tier, "per_class": size, "excluded": dict(excluded),
                "classes": [{"class_id": key, "eligible_originals": len(by_class[key]),
                             "included": size if key in eligible else 0,
                             "deficit": max(0, 400 - len(by_class[key])) if domain == "camera" else None}
                            for key in sorted(known)]}
    return selected, [known[key] for key in sorted(eligible)], coverage


def audit_sample(records: list[dict], seed: str, per_class: int = 20) -> list[dict]:
    rng = random.Random(seed + "-audit")
    groups = defaultdict(lambda: defaultdict(list))
    for row in records:
        source_host = row.get("source", {}).get("page_url", "").split("/")[2:3]
        groups[row["class_id"]][("/".join(source_host), row.get("viewpoint") or "unknown")].append(row)
    chosen = []
    for class_id, strata in sorted(groups.items()):
        queues = list(strata.values())
        rng.shuffle(queues)
        for queue in queues:
            rng.shuffle(queue)
        count = 0
        while count < per_class and any(queues):
            for queue in queues:
                if queue:
                    row = queue.pop()
                    chosen.append({"image_id": row["id"], "class_id": class_id, "result": "pending"})
                    count += 1
                    if count == per_class:
                        break
    return chosen


def release_report(records: list[dict]) -> dict:
    splits = defaultdict(Counter)
    hulls = defaultdict(set)
    for row in records:
        splits[row["class_id"]][row["split"]] += 1
        if row.get("hull"):
            hulls[(row["class_id"], row["hull"])].add(row["split"])
    overlap = [{"class_id": key[0], "hull": key[1], "splits": sorted(value)}
               for key, value in hulls.items() if len(value) > 1]
    return {"split_counts": {key: dict(value) for key, value in splits.items()}, "hull_overlap": overlap,
            "unknown_hull_count": sum(not row.get("hull") for row in records),
            "split_warning": "Grouped splits approximate80/10/10; class/event scarcity may leave a split empty. Hull overlap is reported, not hidden."}


def export_release(collection: Path, records: list[dict], classes: list[dict], output: Path,
                   release_id: str, rights_tier: str, domain: str = "camera", change_history: str = "Initial provisional release.") -> dict:
    check_id(release_id)
    if output.exists():
        raise DatasetError("Release directory already exists; immutable releases require a new ID/path")
    selected, selected_classes, coverage = choose_release(records, classes, rights_tier, domain, release_id)
    # Check every source before creating an output that could be mistaken for a complete release.
    for row in selected:
        for kind in ("original", "crop"):
            asset = row.get("assets", {}).get(kind)
            if not asset:
                raise DatasetError("Original and crop assets required")
            source = safe_path(collection, asset["file_name"])
            if not source.is_file() or sha256_file(source) != asset["sha256"]:
                raise DatasetError("Local asset checksum mismatch or missing source")
            if kind == "original":
                if asset["sha256"] != row.get("sha256"):
                    raise DatasetError("Record's original identity disagrees with actual asset")
                decoded, _ = open_original(source)
                if decoded.size != (row["quality"]["original_width"], row["quality"]["original_height"]):
                    raise DatasetError("Record native dimensions disagree with actual original")
            else:
                box = crop_box(row["target_bbox"], row["quality"]["original_width"], row["quality"]["original_height"])
                with Image.open(source) as cropped:
                    if cropped.size != (box[2] - box[0], box[3] - box[1]):
                        raise DatasetError("Crop dimensions disagree with target annotation")
    # Directory rename is not reliable on some Windows/synced workspaces. A small
    # atomically replaced completion manifest is the commit point instead.
    staging = output
    staging.mkdir(parents=True)
    exported = []
    for row in selected:
        record = copy.deepcopy(row)
        record.pop("held_reasons", None)
        record.pop("unchanged", None)
        record["assets"] = {}
        for kind in ("original", "crop"):
            asset = copy.deepcopy(row["assets"][kind])
            source = safe_path(collection, asset["file_name"])
            relative = f"{kind}s/{row['id']}{source.suffix.lower()}"
            target = safe_path(staging, relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            asset["file_name"] = relative
            asset.pop("key", None)
            record["assets"][kind] = asset
        record["file_name"] = record["assets"]["crop"]["file_name"]
        record["label"] = record["class_id"]
        exported.append(record)
    report = release_report(exported)
    coverage.update(report)
    metadata = {"id": release_id, "created_at": now(), "status": "provisional", "domain": domain,
                "rights_tier": rights_tier, "public": all(row["rights"]["redistribution_allowed"] for row in exported),
                "count": len(exported), "classes": len(selected_classes), "audit_sample": audit_sample(exported, release_id)}
    write_json(staging / "release.json", metadata)
    write_json(staging / "classes.json", selected_classes)
    write_jsonl(staging / "images.jsonl", exported)
    write_json(staging / "coverage.json", coverage)
    write_json(staging / "ATTRIBUTION.json", [{"image_id": row["id"], "source": row["source"], "rights": row["rights"]} for row in exported])
    (staging / "CHANGELOG.md").write_text(f"# {release_id}\n\n{change_history}\n", encoding="utf-8")
    (staging / "README.md").write_text(
        f"# SUBS {release_id}\n\nStatus: provisional; AI accepted, human audit pending.\n\n"
        f"Domain: {domain}. Rights tier: {rights_tier}. {len(exported)} unique originals across {len(selected_classes)} classes.\n\n"
        "Purpose: submarine class recognition from photographs. Class status is a dated fleet snapshot. "
        "Metadata/labels are not model inputs. Target crops derive from unchanged originals and never increase counts.\n\n"
        "Read ATTRIBUTION.json for each image's permissions. This dataset does not grant blanket rights to third-party media. "
        "Public delivery is permitted only when release.json public is true. No license is inferred from online accessibility.\n\n"
        "images.jsonl contains portable relative paths, class IDs, original/crop checksums, provenance, native dimensions, "
        "target coordinates, capture groups, and train/validation/test assignments. checksums.json excludes itself.\n\n"
        "Splits approximate80/10/10 while keeping related exposures together. coverage.json reports hull overlap and gaps. "
        "Satellite labels require independent evidence; no recognition accuracy is asserted. "
        "The source corpus may reflect uneven national, viewpoint, period, and photographic availability.\n\n"
        "Load: from subs_dataset import loader; for images, labels in loader.batches(path, split='train'): ...\n",
        encoding="utf-8")
    checksums = {path.relative_to(staging).as_posix(): sha256_file(path) for path in sorted(staging.rglob("*")) if path.is_file()}
    write_json(staging / "checksums.json", checksums)
    write_json(staging / "COMPLETE.json", {"release_id": release_id, "views": ["original", "crop"], "images_sha256": sha256_file(staging / "images.jsonl"),
                                          "checksums_sha256": sha256_file(staging / "checksums.json")})
    return metadata


def validate_release(root: Path) -> dict:
    completion = require_complete(root)
    checksums = checksum_entries(json.loads((root / "checksums.json").read_text(encoding="utf-8")))
    for relative, expected in checksums.items():
        path = safe_path(root, relative)
        if not path.is_file() or sha256_file(path) != expected:
            raise DatasetError(f"Release checksum mismatch: {relative}")
    records = read_jsonl(root / "images.jsonl")
    validate_splits(records)
    for row in records:
        for kind in completion.get("views", ["original", "crop"]):
            asset = row["assets"][kind]
            path = safe_path(root, asset["file_name"])
            if sha256_file(path) != asset["sha256"]:
                raise DatasetError("Image checksum mismatch")
            with Image.open(path) as source:
                source.verify()
    return {"files": len(checksums), "images": len(records), "valid": True}


def require_complete(root: Path) -> dict:
    marker = root / "COMPLETE.json"
    if not marker.is_file():
        raise DatasetError("Release is incomplete: COMPLETE.json is written only after successful build/download")
    completion = json.loads(marker.read_text(encoding="utf-8"))
    for filename, field in (("images.jsonl", "images_sha256"), ("checksums.json", "checksums_sha256")):
        path = root / filename
        if not path.is_file() or sha256_file(path) != completion.get(field):
            raise DatasetError("Release completion manifest does not match dataset metadata")
    return completion

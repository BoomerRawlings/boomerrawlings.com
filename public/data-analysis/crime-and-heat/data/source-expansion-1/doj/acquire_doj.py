"""Acquire the frozen official DOJ snapshot; fail rather than accept changed bytes.

Python 3.10+; standard library only. Run next to source_metadata.json.
Raw sources are downloaded locally, not bundled with the public supplement.
"""
from pathlib import Path
import concurrent.futures
import datetime
import hashlib
import json
import urllib.request

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)
manifest = json.loads((HERE / "source_metadata.json").read_text(encoding="utf-8"))


def fetch(entry):
    name = entry["filename"]
    if Path(name).name != name:
        raise ValueError("Source filename must be a basename")
    path = RAW / name
    cached = path.exists()
    if cached:
        data = path.read_bytes()
    else:
        request = urllib.request.Request(entry["url"], headers={"User-Agent": "Public-data-research/1.0"})
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != entry["bytes"] or digest != entry["sha256"]:
        raise ValueError(f"Source snapshot changed or corrupted: {name}; do not silently substitute a new release")
    if not cached:
        path.write_bytes(data)
    return {"filename": name, "bytes": len(data), "sha256": digest, "cache_used": cached, "verified": True}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, manifest["files"]))
verification = {"status": "PASS", "checked_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "files": results}
(HERE / "acquisition_verification.json").write_text(json.dumps(verification, indent=2), encoding="utf-8")
print(f"Verified {len(results)} official source files against frozen SHA-256 values.")

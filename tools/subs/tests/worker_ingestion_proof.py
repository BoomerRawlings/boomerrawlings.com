"""Exercise the actual local Worker release from a fresh installed Python environment.

First run node workers/subs/test/serve-fixture.mjs. No production reads/writes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from subs_dataset.client import ApiClient
from subs_dataset.io import DatasetError, write_json
from subs_dataset.loader import batches
from subs_dataset.releases import validate_release


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://127.0.0.1:8788/subs/api/v1")
    parser.add_argument("--release", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--token-env", default="SUBS_FIXTURE_READER_TOKEN")
    args = parser.parse_args()
    if not args.api.startswith(("http://127.0.0.1:", "http://localhost:")):
        raise DatasetError("Fixture proof is restricted to loopback; production is never a test target")
    client = ApiClient(args.api, os.environ.get(args.token_env), allow_localhost=True)
    result = client.download_release(args.release, args.output)
    validation = validate_release(args.output)
    total = 0
    labels_seen = set()
    for images, labels in batches(args.output, split=None):
        assert all(image.mode == "RGB" and min(image.size) > 0 for image in images)
        total += len(images)
        labels_seen.update(labels)
    before = json.loads((args.output / "COMPLETE.json").read_text(encoding="utf-8"))
    resumed = client.download_release(args.release, args.output)
    assert json.loads((args.output / "COMPLETE.json").read_text(encoding="utf-8")) == before
    report = {"fixture_only": True, "actual_worker": True, "fresh_environment": sys.prefix != sys.base_prefix,
              "download": result, "resume": resumed, "validation": validation, "decoded_images": total,
              "classes": sorted(labels_seen), "result": "passed"}
    write_json(args.output.parent / (args.output.name + "-proof.json"), report)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

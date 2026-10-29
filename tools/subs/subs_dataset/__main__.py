"""Run with PYTHONPATH=tools/subs python -m subs_dataset, or the subs.py entry point."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .client import ApiClient
from .discovery import discover_commons
from .io import DatasetError, RateLimitedError, read_jsonl, write_jsonl
from .pipeline import Store, inspect
from .releases import choose_release, export_release, validate_release


def parser():
    main = argparse.ArgumentParser(description="SUBS original-image ingestion and agent-readable releases")
    commands = main.add_subparsers(dest="command", required=True)
    check = commands.add_parser("inspect", help="Inspect decoded native dimensions, sharpness, and hashes")
    check.add_argument("file", type=Path)
    check.add_argument("--bbox", nargs=4, type=int, metavar=("X", "Y", "WIDTH", "HEIGHT"))
    commons = commands.add_parser("discover-commons", help="Find original-file Commons candidates; never auto-label search results")
    commons.add_argument("--class-id", required=True)
    commons.add_argument("--query", required=True)
    commons.add_argument("--output", type=Path, required=True)
    commons.add_argument("--limit", type=int, default=100)
    commons.add_argument("--max-requests", type=int, default=10)
    campaign_plan = commands.add_parser("campaign-plan", help="Freeze an all-class discovery worklist; never approve search results")
    campaign_plan.add_argument("--classes", type=Path, default=Path("public/subs/active.json"))
    campaign_plan.add_argument("--existing", type=Path, required=True, help="Current API image records as JSON or JSONL")
    campaign_plan.add_argument("--campaign", type=Path, required=True)
    campaign_plan.add_argument("--extra-queries", type=Path, help="JSON mapping of class IDs to exact source/hull queries")
    campaign_plan.add_argument("--max-queries-per-class", type=int, default=5)
    campaign_run = commands.add_parser("campaign-discover", help="Resume bounded original-file metadata discovery; no image downloads or approvals")
    campaign_run.add_argument("--campaign", type=Path, required=True)
    campaign_run.add_argument("--max-requests", type=int, default=25)
    campaign_run.add_argument("--max-candidates", type=int, default=1000)
    campaign_run.add_argument("--interval-seconds", type=float, default=10)
    campaign_run.add_argument("--max-metadata-bytes", type=int, default=256 * 1024 ** 2)
    campaign_run.add_argument("--query-id", dest="query_ids", action="append", type=int,
                              help="Resume only this existing positive query ID; repeat to select several")
    campaign_status = commands.add_parser("campaign-status", help="Show per-class coverage, pending discovery and source cooldown")
    campaign_status.add_argument("--campaign", type=Path, required=True)
    campaign_export = commands.add_parser("campaign-export", help="Export unverified discovery candidates for rights/native review")
    campaign_export.add_argument("--campaign", type=Path, required=True)
    campaign_export.add_argument("--output", type=Path, required=True)
    for command in ("discover", "ingest"):
        sub = commands.add_parser(command)
        sub.add_argument("manifest", type=Path)
        sub.add_argument("--store", type=Path, required=True)
        if command == "ingest":
            sub.add_argument("--allow-localhost", action="store_true", help="Test-only loopback HTTP")
            sub.add_argument("--max-requests", type=int, default=1000)
    listing = commands.add_parser("list")
    listing.add_argument("--store", type=Path, required=True)
    verification = commands.add_parser("verify-local")
    verification.add_argument("image_id")
    verification.add_argument("verification", type=Path)
    verification.add_argument("--store", type=Path, required=True)
    correction = commands.add_parser("correct-local", help="Apply reviewed metadata/crop changes; regenerate crop and require reverification")
    correction.add_argument("image_id")
    correction.add_argument("patch", type=Path)
    correction.add_argument("--store", type=Path, required=True)
    export = commands.add_parser("export")
    export.add_argument("--store", type=Path, required=True)
    export.add_argument("--classes", type=Path, required=True)
    export.add_argument("--output", type=Path, required=True)
    export.add_argument("--id", required=True)
    export.add_argument("--tier", choices=("commercial", "research"), required=True)
    export.add_argument("--domain", choices=("camera", "satellite"), default="camera")
    export.add_argument("--change-history", default="Initial provisional release.")
    validation = commands.add_parser("validate-release")
    validation.add_argument("directory", type=Path)
    for command in ("sync", "verify-remote", "publish", "download"):
        sub = commands.add_parser(command)
        sub.add_argument("--api", default="https://boomerrawlings.com/subs/api/v1")
        sub.add_argument("--token-env", default="SUBS_API_TOKEN", help="Environment variable name, never token text")
        sub.add_argument("--allow-localhost", action="store_true", help="Test-only loopback HTTP")
        if command == "sync":
            sub.add_argument("--store", type=Path, required=True)
            sub.add_argument("--job", required=True)
            sub.add_argument("--max-requests", type=int, default=1000)
            sub.add_argument("--max-bytes", type=int, default=1024 ** 3)
            sub.add_argument("--estimated-cost", type=float, default=0)
            sub.add_argument("--update-metadata", action="store_true", help="Explicitly replace changed metadata with revision checks; corrected records need reverification")
        elif command == "verify-remote":
            sub.add_argument("image_id")
            sub.add_argument("verification", type=Path)
            sub.add_argument("--reason", default="")
        elif command == "publish":
            sub.add_argument("--id", required=True)
            sub.add_argument("--tier", choices=("commercial", "research"), required=True)
            sub.add_argument("--domain", choices=("camera", "satellite"), default="camera")
            sub.add_argument("--change-history", default="Initial provisional release.")
        elif command == "download":
            sub.add_argument("release_id")
            sub.add_argument("--output", type=Path, required=True)
            sub.add_argument("--crops-only", action="store_true")
    return main


def run(args):
    if args.command.startswith("campaign-"):
        from .campaign import export_candidates, plan_campaign, run_discovery, status
        public_root = Path(__file__).resolve().parents[3] / "public"
        for path in (args.campaign, getattr(args, "output", None)):
            if path is not None and path.resolve().is_relative_to(public_root.resolve()):
                raise DatasetError("Campaign data must stay outside public/; use ignored .subs-data storage")
        if args.command == "campaign-plan":
            classes = json.loads(args.classes.read_text(encoding="utf-8-sig"))
            existing = (read_jsonl(args.existing) if args.existing.suffix.lower() == ".jsonl"
                        else json.loads(args.existing.read_text(encoding="utf-8-sig")))
            extra = json.loads(args.extra_queries.read_text(encoding="utf-8-sig")) if args.extra_queries else None
            return plan_campaign(classes, existing, args.campaign,
                                 max_queries_per_class=args.max_queries_per_class, extra_queries=extra)
        if args.command == "campaign-discover":
            return run_discovery(args.campaign, max_requests=args.max_requests,
                                 max_candidates=args.max_candidates, interval_seconds=args.interval_seconds,
                                 max_metadata_bytes=args.max_metadata_bytes, query_ids=args.query_ids)
        if args.command == "campaign-export":
            return export_candidates(args.campaign, args.output)
        return status(args.campaign)
    if args.command == "inspect":
        return inspect(args.file, args.bbox)
    if args.command == "discover-commons":
        rows, report = discover_commons(args.class_id, args.query, limit=args.limit, max_requests=args.max_requests)
        write_jsonl(args.output, rows)
        return report
    if args.command == "validate-release":
        return validate_release(args.directory)
    if args.command in {"discover", "ingest", "list", "verify-local", "correct-local", "export"}:
        store = Store(args.store)
        try:
            if args.command == "list":
                return {"images": [{"id": row["id"], "class_id": row["class_id"], "status": row["status"], "held_reasons": row.get("held_reasons", [])} for row in store.rows()]}
            if args.command == "verify-local":
                record = store.verify(args.image_id, json.loads(args.verification.read_text(encoding="utf-8-sig")))
                return {"id": record["id"], "status": record["status"], "held_reasons": record["held_reasons"]}
            if args.command == "correct-local":
                record = store.correct(args.image_id, json.loads(args.patch.read_text(encoding="utf-8-sig")))
                return {"id": record["id"], "status": record["status"], "held_reasons": record["held_reasons"]}
            if args.command == "export":
                return export_release(store.root, store.rows(), json.loads(args.classes.read_text(encoding="utf-8-sig")),
                                      args.output, args.id, args.tier, args.domain, args.change_history)
            results = []
            requests = 0

            def charge_request():
                nonlocal requests
                requests += 1
                if requests > args.max_requests:
                    raise DatasetError("Batch request ceiling reached")

            candidates = read_jsonl(args.manifest)
            for index, candidate in enumerate(candidates):
                if args.command == "discover":
                    results.append({"candidate_id": store.discover(candidate)})
                else:
                    try:
                        record = store.ingest(candidate, allow_localhost=args.allow_localhost,
                                              max_requests=args.max_requests, on_request=charge_request)
                        results.append({key: record[key] for key in ("id", "candidate_id", "status", "held_reasons", "unchanged") if key in record})
                    except RateLimitedError as exc:
                        results.append({"class_id": candidate.get("class_id"), "status": "held", "error": str(exc)})
                        return {"results": results, "requests": requests, "deferred": True,
                                "retry_at": exc.retry_at, "retry_after_seconds": exc.retry_after_seconds,
                                "remaining_candidates": len(candidates) - index - 1}
                    except DatasetError as exc:
                        results.append({"class_id": candidate.get("class_id"), "status": "held", "error": str(exc)})
            return {"results": results, "requests": requests}
        finally:
            store.close()
    client = ApiClient(args.api, os.environ.get(args.token_env), allow_localhost=args.allow_localhost)
    if args.command != "download" and not client.token:
        raise DatasetError("Set the scoped API token in the selected environment variable")
    if args.command == "sync":
        store = Store(args.store)
        try:
            return client.sync(store, args.job, max_requests=args.max_requests, max_bytes=args.max_bytes,
                               estimated_cost_usd=args.estimated_cost, update_metadata=args.update_metadata)
        finally:
            store.close()
    if args.command == "verify-remote":
        return client.verify(args.image_id, json.loads(args.verification.read_text(encoding="utf-8-sig")), args.reason)
    if args.command == "publish":
        selected, _, _ = choose_release(client.list("images", {"status": "accepted"}), client.list("classes"),
                                        args.tier, args.domain, args.id)
        return client.request("POST", "releases", {"id": args.id, "domain": args.domain, "rights_tier": args.tier,
                              "items": [{"image_id": row["id"], "split": row["split"]} for row in selected],
                              "change_history": args.change_history})
    if args.command == "download":
        return client.download_release(args.release_id, args.output, include_originals=not args.crops_only)
    raise DatasetError("Unknown command")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        print(json.dumps(run(parser().parse_args()), ensure_ascii=False, indent=2))
    except (DatasetError, OSError, json.JSONDecodeError) as exc:
        # System errors may contain local paths, but credentials are never passed as CLI arguments.
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

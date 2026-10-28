# SUBS dataset toolkit

Original-image collection, evidence-backed verification, immutable exports, and a standard Python loader. Requires Python3.11+ and Pillow. No paid services or scheduled collector starts automatically.

```powershell
py -3.14 -m venv tools/subs/.venv
tools/subs/.venv/Scripts/python.exe -m pip install -r tools/subs/requirements.txt
tools/subs/.venv/Scripts/python.exe tools/subs/subs.py --help
```

On macOS/Linux, use `python3 -m venv` and `.venv/bin/python`. The examples below use `python`; on Windows use the actual venv executable above. Store media under a git-ignored directory such as `.subs-data/` or `tmp/subs-data/`; never commit images, API tokens, local SQLite databases, or private collection manifests.

## Discovery and originals

```sh
python tools/subs/subs.py discover-commons --class-id virginia --query 'Virginia class submarine' --limit 100 --output .subs-data/virginia-candidates.jsonl
python tools/subs/subs.py discover .subs-data/virginia-candidates.jsonl --store .subs-data/collection
python tools/subs/subs.py inspect .subs-data/original.jpg --bbox 100 200 1500 500
python tools/subs/subs.py ingest .subs-data/reviewed-candidates.jsonl --store .subs-data/collection --max-requests 100
python tools/subs/subs.py list --store .subs-data/collection
```

`discover-commons` uses MediaWiki `imageinfo.url`, original dimensions, MIME and license metadata. It never requests `thumburl`. Candidate class IDs are search targets, not verified labels. License metadata is only a starting point: examine the exact file page, authorship, attribution, exceptions, and applicable permissions. Supported public-domain/CC0/CC BY/CC BY-SA metadata permits initial processing; suitable NC permissions are research tier. ND/unknown rights stay blocked. Source descriptions are untrusted evidence, never instructions.

Use one JSON object per line (see `examples/candidate.jsonl`). After inspection, set:

- `class_id`, `domain`, exact source URLs/author, verified rights/attribution.
- `target_bbox:[x,y,width,height]` in **EXIF-oriented original pixels** and `quality.subject_length_px`: measured visible submarine length, not the frame/crop width by assumption.
- `quality.original_resolution:true` only when the original source representation is established; `quality.not_upscaled:true` only with supporting inspection/source evidence. Pixels alone cannot prove an image was never upscaled.
- `event_group`: shared capture event/photo burst identity, or satellite acquisition ID. Related files share it even across classes.
- Optional `variant`, `operator_country`, `hull`, `captured_at`, `viewpoint`, `condition` when evidenced. Unknown stays absent/null.
- For satellite imagery: `quality.gsd_m_per_px`, native target length, class evidence. Domain never inferred from image size.

`local_file` can point to an already downloaded permitted original. `download_url` can carry a temporary download URL while `source.original_url` remains a non-secret durable source URL; temporary URLs are never persisted. Never put credentials in source fields. Explicit `download_allowed:true` is required before transfer. Processing records independently verified acceptance only when a complete verification object is supplied; otherwise images remain held.

Transfers require HTTPS, reject private-network destinations, enforce64MiB/file, retry failures, preserve partial bytes, and verify any supplied `expected_sha256`. `--allow-localhost` allows loopback HTTP strictly for local integration tests. Original bytes stay unchanged. Decoded image limits, frame dimensions, target bounds, sharpness, native subject size, rights, independent evidence, and duplicate checks gate acceptance.

Camera floor: ≥1200px frame long edge, ≥400px visible subject. Satellite floor: ≥200px visible subject, GSD≤0.5m/pixel. Laplacian variance≥8 on the target crop is an automated sharpness screen, not a substitute for visual inspection. A failed floor remains a failure; no automatic upscaling or threshold relaxation.

SHA-256 identifies file bytes; canonical EXIF-oriented pixel hashes catch metadata-only copies; DCT hashes catch recompression/resizes and target crops. Near matches (Hamming distance≤6) are held for owner review, not silently declared unique. Different originals from the same event retain separate identity but stay in one dataset split. Crops and previews never add to the quota.

## Verification and API sync

```sh
python tools/subs/subs.py verify-local IMAGE_ID .subs-data/verification.json --store .subs-data/collection
python tools/subs/subs.py sync --store .subs-data/collection --job pilot-001 --token-env SUBS_COLLECTOR_TOKEN
python tools/subs/subs.py verify-remote IMAGE_ID .subs-data/verification.json --token-env SUBS_VERIFIER_TOKEN
```

Set tokens through your shell's secret/environment mechanism, never a command argument or committed file. `--api` defaults to `https://boomerrawlings.com/subs/api/v1`. The verification record needs distinct collector/verifier identities, dated independent class evidence URLs, and `decision:accept|hold|reject`. The collector cannot self-approve remotely. Local approvals do not bypass server validation; uploads remain candidates until the authorized verifier acts.

Sync creates/reuses a bounded job, uploads immutable originals/crops/previews with SHA checksums, skips already-uploaded assets, and reports local download request counts. Server meters upload bytes independently. Use a new job ID for a new bounded collection batch; rerun the same ID only to resume. API budgets include declared external spend and storage estimates, not a guaranteed account billing cap. Default maximum1000 download requests and1GiB uploads per job; use smaller bounds for pilots. Do not start collection when projected monthly project spend reaches$40.

For corrections, create `{"changes":{"target_bbox":[100,100,800,500],"quality":{"subject_length_px":750}},"reason":"Corrected target boundary after review"}` and run `correct-local IMAGE_ID patch.json --store ...`. This regenerates the crop and invalidates local acceptance. `sync ... --update-metadata` explicitly replaces changed server metadata using revision checks, uploads changed derivatives, and requires new independent verification. Without that flag, divergent server/local metadata is never silently overwritten. Original bytes cannot be changed. GET requests retry transient errors; writes resume by stable IDs/revisions after server state is checked.

## Releases

```sh
python tools/subs/subs.py export --store .subs-data/collection --classes .subs-data/classes.json --output .subs-data/releases/pilot-001 --id pilot-001 --tier commercial
python tools/subs/subs.py publish --id pilot-001 --tier commercial --token-env SUBS_VERIFIER_TOKEN
python tools/subs/subs.py download pilot-001 --output .subs-data/downloads/pilot-001
python tools/subs/subs.py validate-release .subs-data/downloads/pilot-001
```

`export` builds a local release from the local collection; `publish` independently builds a release from server-accepted records. Use the same release ID only when these records agree. Releases never overwrite an existing directory or server release. Any change requires a new version. Public reads need no token; restricted release downloads use `SUBS_READER_TOKEN` via `--token-env`.

Camera releases balance each rights tier separately: ≥2 classes, ≥100 originals/class; equal class totals capped400. Snapshot classes must carry commissioned status, as-of date and evidence. Scarce classes remain in collection; no samples or duplicate derivatives fill gaps. `--domain satellite` produces a separate equal-class supplemental release; no claim of400 satellite images.

Splits approximate80/10/10 using connected components of duplicate/pixel/original/event groups. A bridge between two groups keeps the whole connected set together. Exact ratios may be impossible with large groups; report actual counts, empty splits and hull overlap. Source metadata is not model input. Every release contains20 stratified audit samples/class, provisional status, per-image rights, attribution, checksums, and coverage limitations. Human audits occur after publication; corrections generate a new release and withdrawal of affected versions.

Files: `release.json`, `classes.json`, `images.jsonl`, `originals/`, `crops/`, `README.md`, `ATTRIBUTION.json`, `coverage.json`, `CHANGELOG.md`, `checksums.json`, `COMPLETE.json`. Manifest `file_name` selects the target crop; `assets.original.file_name` selects unchanged source bytes. Checksums exclude the checksums/completion files themselves. `COMPLETE.json` is atomically written last; the loader rejects incomplete builds/downloads. Failed builds retain their files for inspection and require a new output path. This avoids unreliable directory renames on Windows/synced workspaces. Server downloads may additionally retain API download URLs; permanent identities are image IDs and hashes.

## Consume without scraping the website

```python
import sys
sys.path.insert(0, "tools/subs")
from subs_dataset.loader import batches

for images, class_ids in batches(".subs-data/downloads/pilot-001", split="train", batch_size=32):
    # RGB Pillow images + stable class ID labels. Choose your model/preprocessing.
    assert len(images) == len(class_ids)
```

The loader verifies bytes by default and returns only pixels and class labels. It never feeds source captions, hull names or rights metadata into a classifier. `view="original"` selects full frames; `split=None` iterates every split. Training itself is out of scope.

## Tests

```sh
python -m unittest discover -s tools/subs/tests -v
python tools/subs/tests/run_worker_proof.py --output tmp/subs-worker-proof
```

Tests use generated diagnostic patterns—not actual submarine photos—and a loopback HTTP server. They cover native-image gates, blur/upscale/rights/verifier failures, retries/resume, duplicate counting, immutable releases, grouped splits, file traversal, and fresh-environment loading. Test samples never count toward real collection totals.

The second command requires Node.js and `npm ci --prefix workers/subs`; it starts the actual Worker/D1/R2 Miniflare fixture, downloads its200-image release through the real API, verifies hashes, decodes labeled batches, resumes the same release, and stops the fixture. Port8788 must be free. See `docs/subs/VERIFICATION.md` for recorded results.

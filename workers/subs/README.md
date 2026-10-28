# SUBS dataset API

Cloudflare Worker + D1 metadata + private R2 assets. Astro/GitHub Pages remains the website. Only `boomerrawlings.com/subs/api/*` routes here. No public bucket, DNS replacement, scheduled collection, model hosting, or secrets in static code.

## Local verification

```powershell
cd workers/subs
npm ci
npm test
npm run check
npx wrangler types
npx wrangler deploy --dry-run
```

Tests use real local workerd/Miniflare, SQLite/D1, and R2. Fixture imagery is generated solely for tests and never enters the actual collection. The Miniflare version is aligned with the runtime used by this pinned Wrangler release. `worker-configuration.d.ts` is generated/ignored rather than copying machine configuration into Git.

For local browser/API development, put four distinct, random, >=24-character test credentials in ignored `.dev.vars` using the secret names below. Never reuse production secrets. Add local Astro origins to a local Wrangler override if cross-origin testing is needed. Apply migrations locally with `npx wrangler d1 migrations apply subs-catalog --local`, then `npm run dev`.

## Production provisioning

The committed config references the task's provisioned `subs-catalog` D1 database and private `subs-dataset` R2 bucket. Root deployment owns provisioning and publication; this package does not activate paid collection or alter nameservers.

1. Run the tests and deployment dry run.
2. Apply `npx wrangler d1 migrations apply subs-catalog --remote`.
3. Set four distinct secrets through `wrangler secret put`: `OWNER_TOKEN`, `COLLECTOR_TOKEN`, `VERIFIER_TOKEN`, `READER_TOKEN`. Token values must never be written to project state, logs, screenshots, committed files, or command arguments.
4. Deploy the Worker with `npx wrangler deploy` and import the dated class roster with the owner credential.
5. Verify health, public metadata, scoped credentials, and a non-public fixture before activating the website's API views.

Full browser sign-in is deferred. Public/unlisted approved reads are genuinely public. Writes always require scoped bearer credentials. The riddle grants no API privileges. Owner tokens are entered into the editing session only, kept in memory, and omitted from URLs/local storage. Read-only agents need `READER_TOKEN` only for restricted records. Collectors cannot approve; independent verification uses `VERIFIER_TOKEN` and distinct collector/verifier identifiers. Owner overrides for near-duplicate false positives require both a written reason and all reviewed conflicting image IDs.

## Contract and eligibility

See `CONTRACT.md`. Machine-readable OpenAPI3.1 and record schemas: `GET /subs/api/v1/openapi.json`.

- Images start as candidates. Discovery can be incomplete; acceptance cannot.
- Original bytes are SHA-256 checked by R2 and image headers checked against declared native dimensions. HTML/thumbnail substitutions fail before storage is attached to the record. Header inspection is bounded at1MiB; classic TIFF/JPEG/PNG/WebP supported. BigTIFF and unsupported headers remain held for local conversion/review; conversion never fabricates native resolution.
- Full decoding, blur measurement, native-detail inspection, duplicate discovery, and semantic/rights review happen in the separate Python/agent verifier. Header checks alone do not prove a photo is sharp, undamaged, or correctly labeled.
- Qualifying camera: >=1200 native image long edge, >=400px subject. Satellite: >=200px subject, positive GSD<=0.5m/px. Bbox must fit original dimensions; declared subject length cannot exceed bbox long edge. Original-resolution/not-upscaled/sharp flags, source/rights evidence, all3 assets, decoded-pixel hash, perceptual hash, capture/duplicate groups, commissioned class, and independent verifier required.
- SHA/pixel duplicates and duplicate groups cannot be accepted twice. Perceptual hashes within6 bits require explicit owner review. Such a heuristic can produce false positives; it never silently merges records.
- Candidate/restricted assets cannot be read without a credential. Every response is no-store/noindex/nosniff. Corrections demote acceptance; crop changes remove the derived crop reference. Changes revoke affected releases explicitly so older manifests never silently resolve to different accepted bytes.

## Releases and audit

`POST /releases` takes selected image IDs and grouped split assignments. Server snapshots metadata/assets, validates eligibility, creates checksummed files in R2, then publishes as provisional. IDs are immutable, including failed attempts. Inspect an existing ID after an interrupted request; use a new ID for corrected attempts.

Camera releases require at least2 classes, equal counts of100–400 each, one rights tier, and one original per duplicate group. Group-aware train/validation/test assignments cannot split an event or duplicate group. Satellite releases are separate, balanced, and require at least2 classes, without claiming a400-image quota. The local exporter chooses80/10/10 approximately; coverage records actual splits and hull overlap. Manifests use target crops as default file_name but retain originals and all asset checksums. Copyright/permissions remain per-image; a tier is not a substitute license.

Releases include up to20 deterministic, source/view-stratified audit picks per class. Audits occur after provisional publication. Failure quarantines the original upload's collection job and capture event, withdrawing every affected release. Owner uploads without a collection job use event grouping. Withdrawn version metadata remains readable; its release files and quarantined image bytes return unavailable. Corrections produce a new version.

Generation uses bounded snapshot batches and streaming JSONL. Original/crop/preview paths are relative, stable and checksum-verifiable. The API supports ranges for resumable downloads. Large release POST clients should allow several minutes; no fixed latency or model accuracy claim is made.

## Cost controls

Collection is on demand. Jobs reserve declared external costs plus maximum upload-storage allowance atomically against the projected$40 collection stop. Request/byte counters update conditionally, preventing concurrent uploads exceeding a job quota. Completed/failed jobs release unused reservations; actual stored bytes and declared spend remain counted. Local tooling must report external requests and paid API costs; the Worker cannot observe unrelated accounts or spending.

Projection conservatively includes$5 baseline plus R2 standard storage at$0.015/GB-month, disregarding free storage allowance. `object_inventory` reserves bytes before R2 writes and retains superseded/orphaned objects in budget accounting, including failed-write reservations. Reconcile inventory against R2 before cleaning unreferenced objects or releasing reservations. Set account billing alerts separately; application thresholds do not create a provider-enforced$50 billing cap. Public-read request/D1 overages still need account monitoring. Failed private objects are not exposed.

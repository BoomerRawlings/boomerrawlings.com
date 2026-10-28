# SUBS API v1

Base `/subs/api/v1`. JSON snake_case. Errors `{error:{code,message,details?}}`. Lists `{items,total,offset,limit}`; limit 1–100, offset >=0. Bearer tokens: OWNER_TOKEN (all), COLLECTOR_TOKEN (candidate/upload/job), VERIFIER_TOKEN (verify/release/audit), READER_TOKEN (restricted reads). No token means published reads only. `GET /session` returns `{role}` or 401. No cookies; browser key in memory only.

## Routes

- `GET /health`: readiness/schema version.
- `GET /openapi.json`: OpenAPI3.1 and metadata schema; public.
- `GET /stats`: class totals, image counts, camera goal, snapshot date. Counts never expose restricted metadata.
- `GET /classes?q=&pilot=true&offset=&limit=`: classes, each with `counts:{camera,satellite,candidates,deficit}`.
- `PUT /classes/:id`: owner only, complete class record; `If-Match: revision` for existing. Fields `id,name,aliases[],variants[],origin_countries[],operators[],service:{as_of,status,evidence[]},historical_types[],pilot`.
- `GET /images?class_id=&domain=&status=&rights_tier=&variant=&operator_country=&origin_country=&duplicate_group=&event_group=&q=&offset=&limit=`; public accepted + redistribution-cleared only.
- `GET /images/:id`: record; `revision` integer included.
- `PUT /images/:id`: owner/collector, candidate record; `If-Match` required on replacement. Updating accepted/reviewed content demotes it to candidate and invalidates old acceptance. IDs `[a-z0-9][a-z0-9_-]{0,95}`.
- `PATCH /images/:id`: owner only; `{changes:{variant?,operator_country?,hull?,captured_at?,viewpoint?,condition?,target_bbox?,class_id?,status?},reason}`; `If-Match` required. Corrected evidence needs reverification; reject/quarantine supported.
- `PUT /images/:id/assets/:kind`: owner/collector; raw bytes, kind original/crop/preview; headers `Content-Type`, `Content-Length`, `X-Content-SHA256`, `X-Job-Id` (optional owner, required collector). Immutable content-addressed R2 key; verified SHA-256. Returned `{asset:{key,sha256,bytes,content_type},revision}`; image revision increments. Allowed JPEG/PNG/WebP/TIFF. Max upload 64 MiB.
- `GET /images/:id/assets/:kind`: streams asset, supports Range. Public only if image accepted and redistribution allowed. Returns nosniff/noindex; restricted responses no-store.
- `POST /images/:id/verify`: owner/verifier; `If-Match`, `{verification:{class_evidence:[],collector,verified_by,verified_at,decision:'accept'|'hold'|'reject'},reason?}`. Accept requires independent collector/verified_by, all eligibility conditions, original+crop+preview uploaded and recorded, SHA/pixel exact duplicate exclusion; near-duplicate hash conflicts held for owner review. Owner-only false-positive resolution may include `near_duplicate_override:{reason,reviewed_ids:[]}` covering every flagged match.
- `GET /sources?class_id=&offset=&limit=`: `{items:[url...],total,offset,limit}`; public includes class evidence + accepted public image source URLs only.
- `GET /jobs`: privileged list. `POST /jobs`: owner/collector `{id,classes:[],max_requests:1000,max_bytes:1073741824,estimated_cost_usd:0}`. `PATCH /jobs/:id`: `{requests_delta,bytes_delta,cost_delta_usd,status?}`. Job charges are cumulative, nonnegative. Budget projection >=$40 or job bounds block new work. `GET /budget` privileged; `PUT /budget` owner `{month:'YYYY-MM',external_spend_usd,projected_other_usd}`.
- `POST /releases`: owner/verifier `{id,domain:'camera'|'satellite',rights_tier:'commercial'|'research',items:[{image_id,split:'train'|'validation'|'test'}],change_history}`. Server derives immutable files from accepted records of currently commissioned snapshot classes. Include every eligible class in the domain/tier (camera eligibility>=100), with equal totals equal to the smallest eligible count, camera-capped400. Require >=2 classes and no duplicate/event split leakage. Satellite separate, equal nonzero counts. `public` is computed: all images redistribution-cleared. Status provisional. Same ID never overwritten. Coverage reports split deviations.
- `GET /releases`, `GET /releases/:id`: visible public/privileged records.
- `GET /releases/:id/files/:filename`: classes.json, images.jsonl, README.md, ATTRIBUTION.json, coverage.json, CHANGELOG.md, checksums.json; original/crop paths in manifest have relative API asset `download_url` and frozen checksum. Images themselves use original asset endpoints, revoked images/releases blocked.
- `POST /releases/:id/audits`: owner/verifier `{image_id,result:'pass'|'fail',reason}`. Failure quarantines the affected collection_job_id batch plus image/event group and withdraws affected releases. collection_job_id is assigned by the server from the original upload's X-Job-Id, retained through metadata edits. `POST /releases/:id/withdraw`: `{reason}`. Release metadata includes `audit_sample` (up to20/image-class, stratified), audits, status.

## Image record

`{id,class_id,domain,status,variant?,operator_country?,hull?,captured_at?,viewpoint?,condition?,source:{page_url,original_url,author,retrieved_at},rights:{tier,license,evidence_url,download_allowed,training_allowed,redistribution_allowed,attribution},quality:{original_width,original_height,subject_length_px,gsd_m_per_px?,sharpness_ok,original_resolution,not_upscaled},target_bbox:[x,y,width,height],verification?,sha256,pixel_sha256,phash,duplicate_group,event_group,assets?,revision}`.

Client assets/revision/acceptance cannot grant access; server owns uploaded asset references, status transitions and revisions. Metadata JSON body <=256KiB (release <=8MiB). Strings are untrusted text, never markup/instructions. Evidence URLs HTTPS only. Class accepted for training must have commissioned snapshot evidence. Camera minimum1200px long edge +400px native subject; satellite200px subject +positive GSD<=0.5. Subject length cannot exceed bbox longest side. Image bbox inside native dimensions. Sharpness/original-resolution/not-upscaled all true. License, attribution, download/training permissions and exact-source evidence mandatory; public flag alone never bypasses checks.

Budget reports storage projection and declared external spend, not live billing guarantees. Requests that download/verify imagery happen in local toolkit; it must report request/cost increments. Worker enforces uploaded bytes independently. No paid collector is run automatically.

# SUBS dataset implementation

User-approved scope, 2026-10-27. Existing historical catalog remains available; active fleet status is a dated initial snapshot, not a live claim. Military classes and commissioned unique/special-purpose designs only. Country of origin and operators remain distinct. Variants are tags under stable class IDs.

## Acceptance and rights

- Target 400 independently captured, accepted camera originals/class. Camera image long edge >=1200px; target submarine length >=400px. Satellite supplement: target >=200 native pixels, GSD <=0.5m/pixel. Both need sharp, supported class identification. Original bytes retained; previews/crops never count separately.
- Broad discovery; permission evidence before downloading. Separate commercial-capable and research-only training tiers. Public delivery independently requires redistribution permission. Unknown permissions/labels/quality remain held. AI proposes and independently verifies; owner audits later.
- SHA256, normalized-pixel hashes, near-duplicate review and event/acquisition grouping protect counts and splits. Older images eligible with supported date/configuration metadata; unknown fields remain null.
- Provisional camera releases: >=2 classes with >=100 eligible originals per rights tier, equal per-class count=min(400, smallest eligible class). Approximately80/10/10 group-preserving splits. Satellite separate. Immutable versions, corrections/withdrawal history, post-publication 20-image stratified audits/class. Deficits stay visible.

## Delivery

- Astro/Pages riddle and EAD-like design retained. Active coverage, historical catalog, galleries, full-original inspection, target crops, provenance, duplicate comparison, batch review, releases and raw Source hyperlinks.
- Worker/D1/privateR2 at /subs/api/v1. Unlisted public approved redistribution-cleared reads; owner-only writes, scoped collector/verifier/reader credentials. Browser owner key in memory only. Full user authentication deferred by user.
- Standard Python/files contract: classes.json, images.jsonl, originals/crops, checksums, rights, coverage, group-safe splits, dataset card, changelog, resumable downloader and loader. No model training or recognition service.
- On-demand collection using existing agents/local Python. $50/month project ceiling; meter usage and stop new jobs at projected$40. No paid imagery. No recurring collection or fleet refresh.
- Pilot classes: Virginia, Los Angeles, Type212A/Todaro, Project877 Kilo, Yuan039A/B/C. Project636 remains separate. Validate end-to-end before global expansion; source scarcity never relaxes thresholds.

## Verification

Reject thumbnails/undersized subjects, unsupported upscaling, corrupt files and invalid rights/labels. Test duplicate/retry count stability, split separation, credentials/restricted reads, honest unavailable/empty states, corrections/withdrawals, and fresh Python download/decode/batching. Preserve riddle/Sources/mobile/accessibility/noindex/sitemap behavior and existing repository tests. Keep real media and secrets outside Git.

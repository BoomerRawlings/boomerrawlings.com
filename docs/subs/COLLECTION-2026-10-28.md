# Pilot collection review — 2026-10-28

Live collection: **25 approved camera originals**, up from five. The target remains **400 per class**; no balanced training release is eligible. Fleet snapshot remains 2026-10-27. This report describes a bounded collection batch, not completed global coverage.

| Class | Newly approved | Total approved | Remaining to 400 | Held leads | Excluded |
|---|---:|---:|---:|---:|---:|
| Virginia | 2 | 3 | 397 | 81 | 14 |
| Los Angeles | 5 | 6 | 394 | 154 | 18 |
| Type 212A | 6 | 7 | 393 | 64 | 38 |
| Project 877 Kilo | 5 | 6 | 394 | 62 | 51 |
| Yuan | 2 | 3 | 397 | 0 | 2 |

## Review and source yield

All **347 initial candidates** received a recorded decision: **20 accepted, 204 held, 123 rejected**. Metadata review covered every candidate; native image inspection covered the downloaded originals. Holds do not imply completed image verification.

Downloaded **23 full-resolution originals, 77,249,927 bytes**. Twenty passed separate collector/verifier review. Three remain private and uncounted: two lack sufficient native subject detail despite passing the numerical sharpness screen; one has conflicting photographer credits. Definite exclusions include models, interiors, undersized source files and incorrect classes. Ambiguous captions remain holds. Project 636 is separate from Project 877.

Added **157 filtered source leads**: Virginia 3, Los Angeles 88, Type 212A 35, Kilo 31. These are metadata leads, with permission flags unset until verified. The collection now has 509 records: 25 accepted, 361 held, 123 rejected. No satellite originals qualified.

## Quality and provenance

Camera floors remain ≥1,200px native frame long edge and ≥400px native visible subject length. Each new acceptance has unchanged original bytes, a separately derived crop/preview, source and license evidence, supported class identification, and independent verification. Partial sail/hull views, occlusion and uncertain dates are explicit; missing hull or variant information stays unknown. Current coverage is too sparse and uneven for claims about classifier performance.

Exact-byte, canonical-pixel and whole-image/target perceptual comparisons found no duplicate matches among the 25 accepted originals. Related captures retain shared event groups, including the existing Yuan visit image and its newly accepted companion. Derivatives never increase counts.

Source evidence resides in each [image record](https://boomerrawlings.com/subs/api/v1/images). Relevant permission evidence includes [DVIDS copyright guidance](https://www.dvidshub.net/about/copyright) and the [Konflikty.pl attribution grant](https://commons.wikimedia.org/wiki/Template:Konflikty.pl). A hosting-site license tag alone does not resolve conflicting authorship.

## Verification and collection limits

All 25 production originals were downloaded through public asset endpoints, decoded, and checked against recorded dimensions, byte hashes and pixel hashes. Public listing contained exactly those 25 accepted records. Sampled held/rejected metadata, originals and previews returned 404. Repeated synchronization uploaded zero assets and preserved counts. No release was manufactured below the two-class/100-original minimum.

Wikimedia returned HTTP429 with a 600-second cooldown. Two later shared queues stopped on their first429; the second used 30-second spacing after the cooldown. Original collection is paused between batches. DVIDS full-size downloads require login; NARA API access requires a key. Thumbnails and guessed download URLs were not substituted.

Toolkit fixes stop/defer ingestion on429 and preserve partial downloads. Explicit visual sharpness failures cannot be overwritten by a high metric. Crop corrections invalidate verification; metric-only failures may recover after a valid correction and fresh review.

Five bounded jobs completed. Stored originals/derivatives total **133,973,965 bytes**. Projected monthly cost **$5.002**, including a conservative $5 baseline; this is not a provider invoice. External collection spend: $0. Request quota charges include documented conservative lookup/read allowances; they are not claimed as exact HTTP measurements. The $40 collection stop and $50 monthly budget remain unchanged; provider billing alerts remain deferred by the user.

Next batch: resume eligible full-resolution leads after provider cooldowns, broaden Yuan sources, resolve attribution conflicts, and add viewpoint/hull/event diversity. Keep scarce classes visible and preserve every acceptance threshold.

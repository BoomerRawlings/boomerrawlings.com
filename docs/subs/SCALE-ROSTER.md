# Global collection workload

Pre-campaign audit: 2026-10-28 local date. The frozen **2026-10-27 roster contains 67 eligible classes**, so its target is **26,800 approved camera originals**. Baseline51 represented **0.1903%**; **26,749 remained**. This is the current roster's target, not a certified exhaustive global total. Subsequent progress is recorded in [batch003](COLLECTION-2026-10-28-003.md).

| Scope | Classes | Target | Approved | Remaining |
|---|---:|---:|---:|---:|
| Pilots | 5 | 2,000 | 51 | 1,949 |
| Other roster classes | 62 | 24,800 | 0 | 24,800 |
| Entire frozen roster | 67 | 26,800 | 51 | 26,749 |

At that baseline, all62 nonpilot classes also had **zero candidates** in the live collection. Continuing only the five pilots cannot address the global objective.

## Verified roster boundaries

The [canonical roster](../../src/data/subs/active.json) and public copy are byte-identical. All 67 live class IDs, taxonomy fields and service records match that snapshot. Every included record is marked `commissioned`; no `uncertain` records are inside it. The separate [unresolved roster queue](ROSTER.md#unresolved-queue-and-exclusions) remains incomplete and must not be interpreted as retired or ineligible by default.

This audit did not refresh service status. The roster remains `coverage_status: in_review`. Resolve missing designs and disputed class/variant boundaries deliberately, then version the snapshot; do not silently change frozen release labels. Operator arrays are partial, while design origins remain separate.

Service evidence includes 58 unique URLs across 43 hosts and 30 named operating countries. These references support roster decisions; they do **not** grant image permissions, establish a photograph's class, or measure photo availability. Current collection counts were read from the [class API](https://boomerrawlings.com/subs/api/v1/classes) and [statistics API](https://boomerrawlings.com/subs/api/v1/stats).

## Source-priority hypotheses

These groups guide initial probes, not quota reductions or guaranteed yields. Exact class IDs, evidence counts and flags are recorded in the ignored local campaign inventory, `.subs-data/campaign/roster-audit.json`.

| Group | Classes | Basis and next action |
|---|---:|---|
| Measured collection channels | 4 | Virginia, Los Angeles, Type212A and Project877. Existing accepted photographs demonstrate usable channels. Expand hulls, dates, views and independent capture events;400 remains unproven. |
| Measured scarce pilot | 1 | Yuan. Three approved; latest bounded search added one unusable close-up and no approval. Broaden sources/permissions before accumulating more copies of the same visits. This does not prove global scarcity. |
| Untested public-fleet channels | 30 | **Hypothesis:** official fleet/institution publications and licensed third-party collections may support expansion. Includes Seawolf, Ohio, Astute, Vanguard, Japanese attack classes, Collins, Victoria, European conventional classes and export families. Perform a bounded yield/permission probe per class. |
| Untested special-purpose families | 8 | **Hypothesis:** rescue/special-purpose configurations need early scarcity and variant checks. NSRS, URF, JFD India DSRV, Kawasaki DSRV, DSAR500, DCS, LR5 and Belgorod. No source-yield measurement yet. |
| Other untested classes | 24 | Remaining Russia/China/North Korea and other untested designs. Establish identity, usable source channels and exact permissions first. No inference that their400-image targets are attainable or impossible. |

## Throughput implications

The latest selected batch approved 26 of 33 downloaded files. That **78.8% is a selected pilot-batch yield**, not a forecast for the untested global roster. Report per-source/per-class discovery, permission, native-quality, duplicate and independent-review yields separately.

A single source queue at the observed 65-second spacing would need **at least 483 hours of download spacing** for the 26,749 remaining originals even if every download qualified. This arithmetic excludes review, failures and throttling; it is not an ETA or a universal provider rate limit. Scale across legitimately independent sources with per-source pacing and shared cooldowns, not additional workers that evade one provider's throttle.

Give all 62 unstarted classes a bounded source probe, maintain review capacity alongside acquisition, and keep every class visible with its actual deficit. A candidate is never progress toward 400 until its original, rights, class, native detail, uniqueness and independent verification pass. Balance commercial/research releases separately; satellite imagery never fills camera deficits. Respect the configured Codex-usage stop gate as well as source throttles and infrastructure limits.

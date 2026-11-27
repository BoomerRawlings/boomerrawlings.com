# Measured daily playback

The default **both eras / reconstructed Elo top 30 / 25-map** partition now provides 3,197 dated leaderboard views, replacing monthly-only playback for this presentation. It uses the existing analytical dataset `cb029772bd796bf2`. No raw observations, window calculations, eligibility, normalization, player identities or historical peak values changed. The original 81 monthly partitions remain unchanged and reproducible.

`src/export-daily.mjs` reads only the two relevant indexed cohorts from the database, opened read-only:

| Cohort | Existing qualifying windows | Distinct endpoint days | First–last endpoint |
|---|---:|---:|---|
| CS:GO, Elo top 30, 25 maps | 173,765 | 2,435 | 2013-01-13–2021-05-30 |
| CS2, Elo top 30, 25 maps | 42,962 | 692 | 2024-01-25–2026-11-19 |

The calendar is the union of those 3,127 observed endpoint days and the 171 existing monthly/as-of checkpoints; 101 dates overlap. The resulting 3,197 dates span 2012-09-30–2026-11-21. Checkpoints without a new endpoint carry only already completed windows. They are leaderboard **as-of dates**, not newly measured performances. They retain early empty periods, the missing-source interval, inactivity expiry and the latest acquired date.

For each date, all windows completed on that day are incorporated before ranking. Exact within-day times are unavailable. The active view selects each identity's latest observed qualifying window, then applies the 90-day inactivity limit and the selected metric's missing-value filter. A null latest relative score does not carry an older score into the active leaderboard. Historical-record lists retain each identity's highest prior completed value, including retired players. Both modes retain top-100 search for all ten previously exported metrics. The constituent windows and their relative-reference populations remain game-specific.

The actual missing-source interval remains **2021-05-31–2023-10-24**. Relative analytical qualification takes additional map/reference-population warm-up; an empty relative leaderboard does not prove that no source observations exist. A smoothly moving calendar or bar is presentation geometry. Score labels, ranks and evidence refer to completed measured windows; no interpolated score is added to the analytical dataset.

## Playback timing

The presentation clock sets interval duration from elapsed calendar days divided by 30, multiplied by the selected month duration (1,500, 750 or 350 milliseconds). A speed-scaled 85-millisecond minimum, with an absolute 30-millisecond floor, keeps closely spaced states visible; the selected month duration caps long gaps. Consequently playback deliberately compresses long gaps and expands densely observed dates. Calendar positions still represent real elapsed time; animation speed is not a claim of uniform competition frequency.

Rows, bar geometry and calendar markers transition linearly toward the selected measured states. Their visual duration is at least 225 milliseconds, independent of the faster daily update cadence; new targets continue from the current displayed position. Geometry can briefly trail the exact score label during playback. Labels identify the destination's actual as-of date and actual analytical value, without inventing intermediate scores. Pause settles geometry to the selected observed state over 120 milliseconds. Reduced-motion preferences disable those transitions. Loading waits for real data rather than advancing through fabricated placeholders or catching up by silently skipping states.

## Executed verification

- 63,940 daily/as-of snapshot-metric lists, containing 6,091,940 exported window instances, passed ordering, identity, cohort, no-future-window and active-inactivity checks.
- All 3,420 existing monthly mode/metric lists preserve exactly the same ordered canonical window IDs. Exact historical frontier lists are also identical.
- 200 deterministically spaced exported windows were queried afresh by canonical database ID; every exported field matched, including counts, metrics, identity, dates and map-boundary references.
- Four focused tests exercise same-day batching, no future lookup, the 90/91-day boundary including leap days, persistent retired records, null latest scores, and deliberate corruption detection.

These checks establish consistency with the frozen analytical dataset. They do not remedy source gaps, source errors, full physical database integrity, exact participation assumptions or selected-maximum uncertainty.

## Artifacts and reproduction

```powershell
node --test tests/export-daily.test.mjs
node --max-old-space-size=4096 src/export-daily.mjs
```

Outputs:

- `data/exports/daily/both-elo_top30-25-daily.json.gz`: 9,751,696 bytes; 66,189 distinct stored canonical windows, referenced compactly by the dated views.
- `data/exports/daily/manifest.json`: dataset/version, SHA-256, exact date list, source cohort counts, validation totals and original monthly-file checksum.
- `data/exports/daily/validation.json`: executed checks and failures (none).

Input rows are cached under `data/processed/daily-export/<input-token>/`. The token includes the scientific dataset version, recorded analytical fingerprint, cohort counts/date bounds and exporter source hash. Every 1,000 rows commits a byte boundary, cursor and SHA-256 checkpoint. An interrupted input read verifies that checkpoint before resuming; incomplete trailing cache bytes are discarded only within this exporter-owned cache. Completed caches are checksum-verified. Final gzip and manifest writes use temporary files and atomic replacement. The export enforces a 40 MiB compressed size ceiling; actual output is approximately 9.3 MiB.

The partition retains the existing compact `columns`, `rows`, `snapshots`, `frontiers`, licensing and provenance fields. Additions are `dates`, `observed_endpoint_dates`, `asof_checkpoint_dates`, and `snapshot_granularity: "daily_with_monthly_gap_checkpoints"`. Publication supplies a separate immutable URL through `meta.partition_overrides["both-elo_top30-25"]`; other specifications continue to use the existing monthly files. An override does not rewrite the immutable historical release.

# Decision log

- **Storage:** SQLite with built-in Node24 driver. Indexed relational provenance and cohorts fit one-user research; static exports serve the website without new hosted infrastructure.
- **Acquisition:** pinned public bulk releases, manifests and checksums. No direct bulk HLTV scraping (terms prohibit it), paid subscription, authentication bypass or fabricated backfill.
- **Historical source:** Filipe v1 has stable player/team/mapstats paths and nine years of raw per-map counts. Prefer it over overlapping Machado data; Machado is an independent reconciliation archive, not public canonical data.
- **Recent source:** Ektarr v12 contains actual per-map scoreboard counts. `is_total=True` rows are series aggregates and excluded from player-map analysis. Team encounter IDs are not stable organizations.
- **Identity:** namespace IDs; 22 verified cross-source anchors require profile/full-name/country evidence. All other unresolved cross-source identities remain separate. Distinct NiKo/niko deliberately preserved.
- **Team continuity:** official source team IDs where available; otherwise same source name plus >=3 shared players within 180 days. This estimates roster lineage, not organizational ownership. Logo change animation uses observed team name changes, not invisible lineage IDs.
- **Map exposure:** scoreboard rounds proxy only for complete, valid 5v5 scoreboards. Substitutions/missing player rows invalidate a map for primary analysis. Denominator assumption is visible.
- **Historical order:** source map order or deterministic IDs within a date when true series/map order unavailable. Never claim exact intraday timing. Reference populations and Elo exclude the entire current day, protecting against within-day future leakage.
- **Opposition:** no defensible dated published rankings acquired. Strict published-top30 analysis returns empty. Alternative Elo K20 uses prior days, minimum five prior maps per ranked team, >=30 active teams, 90-day active horizon. It is explicitly sample-relative.
- **Metric:** preserve raw KPR/DPR/Net KPR and compare experimental composites. Do not choose weights to manufacture a winner. HLTV formulas never combined across eras.
- **Windows:** 10/25/50/100/200 observed consecutive qualifying maps <=365 days; calendar 30/90/180/365 days with minimum ten maps. No mixed game cohort. Missing calendar dates do not produce observations.
- **Uncertainty:** whole-event resampling and matched observed exposure. Conditional intervals are not selection-adjusted confidence that the selected greatest player is truly best. Missing series IDs prohibit genuine match clustering for historical source.
- **Presentation:** user clarified top-player animation as priority. Top100 per monthly snapshot exported; interface shows configurable top10/15/25. Raw full population remains queryable locally. Team/logo transitions use first recorded appearance, not inferred signing dates. Missing photos use honest placeholders.
- **Publication:** user authorized `boomerrawlings.com/cs`; use canonical existing GitHub Pages pipeline, one verified scoped push. No DNS or unrelated portfolio changes.

- **Identity expansion:** 22 verified cross-source anchors after14 additional reviewed links. Migration audited unchanged numeric facts, provenance, membership boundaries and row counts; ambiguous same-name people remain separate.
- **Secondary storage:** raw archives, SQLite database, exports and website checkout/builds reside on the secondary drive; source directory contains filesystem links, not copies of large data.
- **Validation scope:**21/21 database invariants;811 independently reconstructed window samples;34 SQL prior-only reference checks. SQLite quick_check plus FK/uniqueness/logical checks completed; full physical index consistency integrity_check was not completed.
- **Static publication budget:** existing Pages build has a1GB artifact ceiling. Preserve it and unrelated assets. Serve compressed immutable dataset partitions from the public canonical GitHub repository using CORS; UI/media/docs stay at /cs. Exact numbers are not rounded in distribution.
- **Historical display:** both-era view combines homogeneous game windows only. Current observed roster follows the animation date even for a previously achieved record. This is a dated roster observation, not an official transfer announcement.


- **Continuous measured playback:** reuse frozen analytical windows; add daily endpoint/as-of top100 lists for the default both-era Elo25 cohort. Keep monthly source-gap checkpoints and all original81partitions. Match geometric transition duration to a shared playback clock; exact score labels remain observed values. No interpolated research observations. Expanded team marks require per-file identity, license and checksum evidence; opaque marks remain out of growing bars.

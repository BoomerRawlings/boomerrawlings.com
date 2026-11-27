# Validation report

21/21 automated invariants passed. 1,039,610 / 1,069,328 canonical player-map rows pass structural validation (97.221%). Invalid observations retained outside analytical eligibility.

SQLite `PRAGMA quick_check` completed, alongside separate foreign-key, uniqueness and logical checks. A full `PRAGMA integrity_check` did not complete; no completed full physical/index integrity audit is claimed.

An independent implementation additionally passed 811 deterministic sampled window-membership/count checks and 34 prior-only reference-distribution checks, with zero failures (`data/exports/window-membership-validation.json`). These samples are not exhaustive constituent-membership checks, nor independent gameplay observations.

| Check | Result | Violations |
|---|---|---:|
| database_structural_quick_check | PASS | 0 |
| foreign_keys | PASS | 0 |
| duplicate_player_maps | PASS | 0 |
| duplicate_matches | PASS | 0 |
| missing_provenance | PASS | 0 |
| invalid_identity | PASS | 0 |
| invalid_eligible_counts | PASS | 0 |
| same_eligible_team_opponent | PASS | 0 |
| impossible_dates | PASS | 0 |
| outcome_mismatch | PASS | 0 |
| excluded_competition_eligible | PASS | 0 |
| elo_future_leakage | PASS | 0 |
| invented_published_rank | PASS | 0 |
| window_weighted_aggregation | PASS | 0 |
| window_date_boundaries | PASS | 0 |
| count_window_samples | PASS | 0 |
| calendar_window_samples | PASS | 0 |
| ppi_inadequate_reference | PASS | 0 |
| record_progression | PASS | 0 |
| peak_before_window_endpoint | PASS | 0 |
| invalid_map_has_no_valid_player | PASS | 0 |

## Observed data issues

| Flag | Severity | Count |
|---|---|---:|
|team_kill_death_inconsistency|error|2645|
|incomplete_or_substitution_roster|error|2310|
|missing_core_count|error|1500|
|invalid_player_on_map|error|1169|
|impossible_count|error|466|
|invalid_rounds|error|320|
|invalid_identity|error|110|
|same_team_opponent|error|110|
|unresolved_team_on_known_map|error|110|
|duplicate_player_map|error|20|
|duplicate_map_source_row|error|16|
|game_version_from_catalog|warning|1|
|rating_versions_unavailable|warning|1|
|series_ids_unavailable|warning|1|

## Coverage

|Year|Maps|Player maps|Valid rows|
|---|---:|---:|---:|
|2012|466|4632|4440|
|2013|2315|22907|22240|
|2014|2479|24487|23480|
|2015|7390|74021|72320|
|2016|11331|113371|112080|
|2017|16887|168959|167850|
|2018|17997|180060|178770|
|2019|15256|152622|151780|
|2020|13963|139693|138930|
|2021|6507|65113|64650|
|2023|691|6812|5640|
|2024|4483|42843|31750|
|2025|3702|36461|32230|
|2026|3862|37347|33450|

- Structural validation is not independent historical certification.
- Core denominator assumes full map participation in complete 5v5 scoreboards.
- Series counts are unavailable in Filipe; mapstats IDs are map containers.
- 2012–2021 and 2023–2026 source completeness and regional representation unproven.
- No dated verified published top30 archive; strict primary opposition view unavailable.

See independent source reconciliation in reconciliation.json / sources.md. Unit tests additionally exercise leakage, reference populations, exact rolling boundaries and static exports.

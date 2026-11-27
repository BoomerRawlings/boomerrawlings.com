# Data dictionary

Schema is authoritative: `config/schema.sql`. Dates use ISO calendar days; verified source timestamps are retained separately. Quantities are observed source values unless their derivation is explicitly stated.

| Table | Unit / key | Meaning |
|---|---|---|
| sources, raw_files | Source version / file | URL, acquisition timestamp, license, byte count, SHA-256 |
| players | Canonical player ID | HLTV namespace where source profile ID proves it; other source namespace otherwise; birth date null unless verified |
| player_aliases | Player + alias + source | Original spelling, Unicode-normalized search form, first/last observed dates |
| identity_mappings | Source entity ID | Canonical ID, method, confidence, unresolved ambiguity; aliases alone never merge identities |
| teams, organizations | Stable source team or roster lineage | Filipe has HLTV team IDs. Ektarr encounter IDs require same name plus three-player core within 180 days. Organization table intentionally empty without verified corporate history |
| rosters | Team + player + encounter | Observed participation, not contract dates; stand-in null when unknown |
| events | Source event | Source-classified competition or explicit exhibition exclusion; LAN status unavailable |
| matches | Source series/container | Ektarr series ID; Filipe mapstats container **not a genuine series ID** |
| maps | Source mapstats/game ID | Map name, scoreboard, rounds, outcome, source order basis, validation status |
| player_maps | Player + map | Underlying counts, advanced metrics where present, nullable unavailable fields, quality status |
| provenance | Raw file + row + prefix | One-based CSV row including header, source URL and acquisition timestamp |
| staged_observations | Source row | Parsed map context, excluded totals, failed joins; immutable source remains raw layer |
| quality_flags | Entity + issue | Error or warning, readable reason |
| eligibility | Player-map + definition | Explicit eligible boolean and exclusion reason; published top30 stays unavailable without verified historic ranks |
| match_strength, team_rankings | Team at encounter/day | Reconstructed pre-day Elo/rank, prior sample, as-of date; never equated with published rank |
| rolling_windows | Player + cohort + endpoint | Count/calendar window, sample, raw aggregate and relative metrics; compact endpoint provenance in details |
| historical_peaks | Player + metric + improved window | Strictly increasing personal record events; retirement never removes records |
| model_specs, build_metadata | Version/specification | Method parameters and completed stage checkpoints |

## Player-map measurements

`kills`, `deaths`, `assists`, `headshot_kills` are source counts. `adr`, `kast`, `published_rating` are source decimals; KAST is percent 0–100. Filipe's misleading `kdratio` field contains percentage KAST, **not** kill/death ratio. `rounds` is the sum of map scores, used only with a complete valid five-player-per-side scoreboard; it assumes each listed player participated throughout. Individual round participation cannot be verified from these archives.

`regulation_rounds`, `overtime_rounds`, `total_damage`, `opening_kills`, `opening_deaths`, `trade_kills`, `traded_deaths`, `multi_kill_rounds`, `clutch_opportunities`, `clutch_wins`, `weapon_specific`, verified roles, birthdates, LAN classification and most side metrics remain null in the primary sources. Rounded ADR is never relabeled as observed integer total damage. Formula versions for historical ratings remain null; dates do not prove which formula was used when an archive was acquired.

`missingness` classifies default unavailable source metrics, unavailable source metadata and inapplicable fields. Parsing failures are staged/flagged separately. An explicitly observed zero remains numeric zero. `null` never becomes zero in calculations or exports. Observed data that fail validation remain in the database with invalid status; they do not silently disappear from source coverage counts.

## Analytical fields

`kpr=sum(kills)/sum(rounds)`, `dpr=sum(deaths)/sum(rounds)`, `net_kpr=(sum(kills)-sum(deaths))/sum(rounds)`. `adr` aggregates only complete ADR exposure, round-weighted; source rounding remains. `z_*` uses comparable latest windows from each reference player within the preceding 365 days, excluding the endpoint day; `reference_n>=20`. Percentiles and robust median/MAD scores use the same reference population. Every game/window/opposition definition has a separate reference distribution.

`ppi=100+5(z_kpr+z_net_kpr)`, `ppi_defense=100+5(z_kpr+z_neg_dpr)`. Covariance-aware and alternative 75/25 weights are sensitivity definitions, not fitted greatness scores. The ordinary PPI does not have an assumed standard deviation of ten. No index estimates causal round-winning contribution.

Static exports use a shared row dictionary (`columns` plus `rows` arrays) with integer references in monthly snapshots and exact record frontiers. Every dictionary row includes its canonical window ID, boundary map IDs, metric, sample and cohort. Team logo state is looked up from dated observed rosters at the snapshot, independently of when a retained peak occurred.

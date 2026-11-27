# APEX methodology — version 1.0.0

The continuous “Both eras” visualization compares completed CS:GO and CS2 windows calculated separately. No window crosses game versions. Relative scores retain their game-specific reference populations; the combined display is a qualified comparison of observed output/dominance, not equal underlying skill. Missing mid-2021–2023 history remains a gap. Only independently verified identity mappings connect the same player across sources; unresolved identities stay separate.

This is a retrospective observational study of **acquired, eligible records**. A leaderboard is an observed-data result, not proof of the greatest player in unobserved history. Source completeness, inclusion decisions and validation results are separate from analytical correctness. No player is selected by reputation, awards, nationality, trophies or career length.

## Observations and target population

The primary unit is a player-map. Canonical player and team identifiers come from source identifiers, not alias equality. `source_classified` means the record belongs to the source's competitive catalog; it does not certify employment, tournament quality or perfect removal of exhibitions. Explicitly identified exhibitions, showmatches and nonprofessional play must be excluded by ingestion. Uncertain classification remains a limitation, not a verified fact.

The executable eligibility function requires a valid record, accepted professional classification, known game (`csgo` or `cs2`), valid date, positive integer rounds, integer nonnegative kills/deaths, deaths no greater than rounds and kills no greater than five times rounds. Statistical analysis does not repair invalid observations. Duplicate player-map observations cause analysis to fail.

These checks are necessary but not sufficient: correct source parsing, exact player exposure, team/opponent coherence and match-level reconciliation belong to canonical validation. Rounds are player exposure only when that equivalence has been established. Stand-in, partial-map or disconnection cases cannot silently inherit complete team exposure.

## Competition-quality definitions

Three distinct cohorts are implemented:

| Key | Definition | Interpretation |
|---|---|---|
| `all` | All acquired valid source-classified competitive records | Coverage exploration; not equivalent to world-class opposition |
| `published_top30` | Opponent's observed contemporary published rank is 1–30 | Initial intended primary quality definition, only where dated historical rankings exist |
| `elo_top30` | Opponent's reconstructed **pre-match** Elo rank is 1–30 | Alternative reconstructed cohort, never labeled published HLTV top 30 |

Missing rank is not rank 31 and is never treated as meeting a ranked filter. The top-30 filter may produce no records where historical rankings are unavailable. Reconstructed Elo must be computed before incorporating the current match, using only earlier observations; same-date outcomes must not affect same-date predictions where timestamps are unknown. Its universe, initialization, inactivity policy, rating update and warm-up rules must be recorded by the reconstruction pipeline. Early rankings from an incomplete source are especially unstable. These cohorts do not establish equivalence between different regions or eras.

The requested default is 50 qualifying maps within 365 days against published top-30 opponents. If it cannot be populated, APEX must label available alternatives rather than relabeling them as the primary specification. Users can compare the broad and reconstructed cohorts.

## Absolute metrics

Every aggregate uses summed counts:

```
KPR     = sum(kills) / sum(rounds)
DPR     = sum(deaths) / sum(rounds)
Net KPR = (sum(kills) − sum(deaths)) / sum(rounds)
Survival proportion = 1 − DPR
```

Map ratios are not averaged. A 10-round map therefore receives one third the exposure weight of a 30-round map. Overtime remains part of observed exposure when player rounds include it. Offensive production and survival are shown separately.

ADR is computed from total damage where available; otherwise map ADR is weighted by rounds. Published map ADR may already be rounded. An aggregate ADR is emitted only when **every round's map** has damage or ADR coverage. Partial coverage yields null plus `adr_round_coverage`, not a fabricated complete ADR. Reported ADR is not proof of round-winning contribution.

Opening, trade, clutch, side, weapon and role variables are unavailable unless observed by a source. Nulls are not zeros. No role adjustment, map adjustment, economy adjustment, team-resource adjustment, causal contribution or round-win model is claimed by this version.

## Windows and dates

Count windows use 10, 25, 50, 100 or 200 consecutive **qualifying** observations for each player/game/cohort. All count windows are limited to 365 elapsed days by default. Rejected/nonqualifying observations do not count toward the window. A player can qualify for a short window without qualifying for a longer one. `duration_days` is endpoint date minus start date; two maps on the same date have duration zero.

Calendar windows use 30, 90, 180 or 365 days. A D-day window includes dates `(T − D, T]`, i.e. endpoint day and preceding D−1 dates. The default minimum is 10 qualifying maps; this configurable guard avoids labeling one isolated map as a sustained annual peak. Calendar window sample sizes differ and must be displayed.

CS:GO and CS2 are never bridged by primary windows. Version-specific separation also prevents a composite norm from silently mixing both game populations. Equal KPR values across games are equal observed ratios, not necessarily equal underlying skill.

Where exact timestamps are absent, ordering is competition date, numeric source match identifier, source map index, then map identifier. This deterministic fallback cannot establish true within-day order across matches. Records carry `date_precision_day`; intra-day transient frontiers must not be presented with invented times. Dates are interpreted as source-provided calendar dates, without fabricating time zones or match start times.

## Contemporary-relative dominance

A 50-map window is compared with **50-map windows**, not individual maps. Game, quality cohort and window specification are held constant.

For each endpoint date T, the reference population contains the latest completed qualifying window for each player with endpoint in `[T−365 days, T−1 day]`. All endpoints on T use this frozen reference. Excluding the endpoint day prevents unavailable within-day timing from introducing future information. A player's previous window may appear in the reference; there is no leave-one-player-out correction. Each player has equal weight in the reference, irrespective of career length, number of earlier windows or map frequency. An active-leaderboard inactivity rule is separate from this 365-day reference horizon.

At least 20 distinct reference players are required by default. Otherwise relative values are null with `insufficient_reference_population`. Zero variance produces null standardized values, never infinity. The reference cutoff, population size, means, standard deviations and component correlations accompany records. Cohort-specific source gaps can change these reference populations materially.

Standardized scores use the population standard deviation of these observed reference windows:

```
z(x) = (x − reference mean) / reference population standard deviation
```

Robust KPR scores use `(KPR − median) / (1.4826 × MAD)`; zero MAD yields null. KPR and Net KPR percentiles use mid-ranks, with 0 and 100 possible outside the observed reference range. These are descriptive distributions of observed players. They are neither population sampling probabilities nor calibrated tail probabilities. Twenty references are a guard, not evidence of adequate effective sample size.

Default horizon is 365 days. Rerunning normalization with 90 or 180 days is supported; resulting ranks belong to a different specification and must be labeled. Different relative-reference histories cannot be silently combined.

## Peak Performance Index candidates

The proposed candidate is retained without treating it as validated truth:

```
PPI = 100 + 10 × (0.5 z_KPR + 0.5 z_NetKPR)
```

Net KPR contains KPR algebraically. Combining them can emphasize kill production twice. The sensitivity export reports their observed correlation and alternatives:

| Output | Specification |
|---|---|
| `z_kpr`, `z_net_kpr` | Single-component relative scores |
| `ppi` | Equal standardized KPR and Net KPR |
| `ppi_defense` | `100 + 10 × (0.5 z_KPR + 0.5 z_negative_DPR)` |
| `ppi_offense75` | KPR/negative-DPR weights 0.75/0.25 |
| `ppi_survival75` | KPR/negative-DPR weights 0.25/0.75 |
| `ppi_covariance` | Equal KPR/negative-DPR composite divided by its contemporaneous reference SD before scaling |
| `adr` | Raw round-weighted damage where complete |

For equal-weight unit-variance components with correlation ρ, the composite reference SD is `sqrt((1+ρ)/2)`. The covariance-aware candidate uses this denominator; a degenerate denominator yields null. This rescales a chosen index. It does not discover optimal weights, eliminate confounding or validate a latent skill construct.

The ordinary PPI does **not** have standard deviation 10 by construction. Even the covariance-aware candidate has that scale only in its own fixed reference distribution; future endpoints and pooled historical scores need not have SD 10. No model is optimized to put a named player first. No PPI variant is described as causal round-winning contribution.

## Peaks, records and active performance

A player's peak is the highest completed eligible window for the selected metric and specification. A personal record changes only on a strict improvement. Historical records remain after inactivity and retirement. The global frontier follows qualifying new highs within a single comparable cohort. Same-day order is uncertain where source times are missing.

Active performance uses the latest completed qualifying window, subject to the app's explicitly stated inactivity threshold. It does not use a player's historical maximum. Monthly snapshots are views of actual endpoint records, not interpolated performances. Calendar-date trajectories use actual observations. Time since **first observed appearance** is not verified professional debut if source coverage starts late. Age trajectories require verified birth dates and remain unavailable otherwise.

Provenance on each window stores first/last source references and an exact player/game/quality/window/map-boundary selection tuple. Constituent maps, opponents, events and distributions can be recovered from the canonical table with the same deterministic ordering. This avoids duplicating a potentially enormous many-to-many array inside every exported window. A report must include actual map/round sample sizes and window dates.

## Uncertainty and unequal opportunities

`clusteredBootstrap` resamples whole event clusters with replacement, preserving all matches and maps within each sampled event. It returns a percentile interval only with at least eight observed clusters by default. A match-cluster alternative is implemented but explicitly warns that it does not preserve dependence between matches in one tournament. Seeds and repetition counts are stored. Small-cluster cases remain unavailable.

These are **conditional descriptive intervals for a specified observed window**. Applying them to a selected maximum does not make them confidence intervals for the maximum-selection process. They assume exchangeable clusters, do not remove serial dependence across events, and do not capture errors in missing sources, player exposure, classification or identity. No p-value for historical greatness is produced.

`matchedExposurePeaks` compares peaks in each player's first N observed qualifying maps, with N=200 and a 50-map window as defaults. It reports full and matched exposure, actual admissible window counts, dates and both peaks. This shows how opportunity to observe a high window changes under equal recorded exposure. It is not randomized: earlier source censoring, survival to N maps, career stage, inactivity gaps, team strength and differential missingness remain. Full-career peaks have more opportunities to produce an extreme value; overlapping windows are dependent and must not be counted as independent trials.

Selection-adjusted uncertainty for the global maximum remains unresolved. Defensible future work would repeat the entire acquisition-conditioned peak-selection procedure in a hierarchical or moving event-block resampling model, validate that model against temporal dependence, and distinguish inferential targets from descriptive records. An independent future holdout can quantify regression to the mean; historical maxima cannot be confirmed using the same selected observations.

## Bias and unresolved adjustment

| Issue | Implemented handling | Remaining limit |
|---|---|---|
| Famous-player selection | Include all source IDs before filters | Sources may already favor prominent competition |
| Survivorship | Short windows and retired records retained | Missing unsuccessful/short careers cannot be reconstructed |
| Missing-not-at-random coverage | Explicit nulls, gaps and source inventory | Acquisition probability is unknown |
| Regional coverage | No nationality exclusion | Source visibility and inter-region schedules differ |
| Role and team resources | KPR and DPR separate | No verified role/time-varying resource variables |
| Team/opponent strength | Distinct opposition filters, pre-match Elo alternative | Team confounding and incomplete ranking universe remain |
| Unequal career length | Fixed sample windows and matched recorded exposure | Maximum selection remains biased by opportunity |
| Overlap/dependence | No independent-window significance claims; cluster resampling | Serial/tournament dependence may persist |
| Game mechanics | Separate game cohorts and preserve ruleset metadata | Economy/weapon/map changes within a game are unadjusted |
| Relative dominance | Comparable aggregate references using past data only | References inherit coverage and composition changes |

## Published ratings and historical mechanics

Published HLTV ratings are retained as source observations. Ratings 1.0, 2.0, 2.1 and 3.0 are not interchangeable. Rating 2.0 added damage and other components; its exact formula was not published. [HLTV's 2017 introduction](https://www.hltv.org/news/20695/introducing-rating-20)

Rating 2.1 changed the treatment of saving and the CS2 reference averages. [HLTV's 2.1 explanation](https://www.hltv.org/news/40067/the-players-and-roles-affected-by-rating-21)

Rating 3.0 introduced different component construction, including round swing and economy context. Its later revisions further show why acquisition time and observed version matter. [HLTV's 3.0 introduction](https://www.hltv.org/news/42485/introducing-rating-30), [2026 update](https://www.hltv.org/news/45596/rating-30-receives-small-accuracy-improvements)

A match date alone cannot prove which formula a source snapshot displays: providers may recalculate historical values. Unknown version stays unknown. The raw count metrics avoid combining incompatible published rating formulas, but do not establish cross-era skill equivalence. MR15/MR12, overtime, economy, maps, weapons and LAN/online classification must be source-backed where present; missing rule details remain null.

## Reproducibility and verification

Database verification uses SQLite `PRAGMA quick_check` plus separate foreign-key, uniqueness and logical checks. The full `PRAGMA integrity_check` did not complete; this release does not claim a completed full physical/index integrity audit. The executed release passed 21/21 database invariants, 811 independently recomputed sampled window memberships/counts and 34 prior-only reference checks. The latter checks use an independent implementation, not an independent source of gameplay data. See [validation](validation-report.md) and [reconciliation](reconciliation.md).

Structural validity is distinct from historical coverage. Of canonical source rows, 99.01% of Filipe CS:GO rows and 83.48% of Ektarr CS2 rows passed validation. The combined 97.22% pass rate conceals this differential attrition; none of these is a census coverage estimate.

Analysis code: `src/analytics.mjs`. Tests: `node --test tests/analytics.test.mjs`. All defaults are exported as `DEFAULT_OPTIONS`; changed defaults constitute a distinct model specification. `iterateWindowGroups` yields one game/quality/window cohort at a time to limit memory. `computeWindows` is a small-dataset convenience wrapper. Input arrays are not mutated.

Adversarial tests cover count-weighted aggregation, source filtering, game/identity boundaries, duplicate inflation, calendar endpoints, 365-day duration, deterministic source ordering, future-data and same-day leakage, reference sparsity/variance, candidate PPI equations, record progression, clustered resampling and equal-exposure restrictions. They demonstrate implemented behavior, not complete source accuracy. Overall acquired coverage, executed database validation, source reconciliation and actual findings are reported separately.

## Requested analyses not established in this release

| Requested capability | Actual status |
|---|---|
| Published historical top-30 primary comparison | Unavailable; broad catalog and reconstructed Elo are explicitly separate alternatives |
| Opponent-, role-, map-, stage- and resource-adjusted models | Not fitted; Elo eligibility is a competition filter, not an opponent-adjusted performance regression |
| Tournament-strength/event-based alternative eligibility | No validated strength classification; catalog membership alone does not establish event strength |
| ADR-inclusive composite | Not fitted; complete-coverage ADR is a separate raw metric |
| Opening, trade, clutch, weapon and side models | No consistent acquired coverage for such analyses; nullable schema fields do not establish measurement availability |
| Causal round-winning contribution | Not identified or validated |
| Age and true professional-debut trajectories | Unavailable; verified birth dates absent, first observed appearance is source-censored |
| Full public career trajectories | Static snapshots retain top 100 per metric/date; public trajectories and search are limited to exported identities/endpoints |
| Time above an elite threshold | Not estimated continuously; the app's persistence display counts observed exported endpoints, not duration above a threshold |
| Selection-adjusted peak uncertainty | Not estimated; cluster intervals condition on a selected window and do not repeat maximum selection |
| Regression-to-the-mean validation | No independent future holdout study executed |

The continuous animation combines separately calculated game cohorts; it does not repair missing history or make game-specific standardized scores measurements of identical underlying skill.

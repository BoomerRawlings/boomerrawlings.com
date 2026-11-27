# APEX observed-data research report

Generated 2026-11-27T10:50:37.245Z. Analysis apex-1.0.0.

**No complete-history winner is established.** Findings below describe acquired eligible records. The requested published-top-30 primary specification has no validated historical ranking coverage. Broad-catalog and reconstructed-Elo alternatives are separate.

## Acquired coverage and validation

15,941 canonical player IDs; 6,277 source-ID/roster-lineage team IDs; 107,329 maps; 1,069,328 player-map observations. 1,039,610 passed canonical map/player validation (97.22% of canonical observations); 1,037,490 eligible in the broad competitive cohort. These denominators exclude raw records never parsed into canonical observations.

The database contains 100,713 match containers: 6,122 source series-level IDs and 94,591 map-only containers with unavailable series identity. A true total of unique historical series cannot be recovered from these map-only IDs. Unresolved cross-source player links mean canonical IDs are not a proven count of unique people. Team identities are not verified organizations. Validation pass rate measures implemented consistency checks, not truth or historical completeness.

| Source | Game | Acquired dates | Maps | Player-maps | Valid player-maps |
|---|---|---|---:|---:|---:|
| [filipe](https://www.kaggle.com/datasets/filipechavesdemacedo/counter-strike-competitive-data) | csgo | 2012-09-13–2021-05-30 | 94,591 | 945,865 | 936,540 |
| [ektarr](https://www.kaggle.com/datasets/ektarr/counter-strike-pro-matches) | cs2 | 2023-10-25–2026-11-21 | 12,738 | 123,463 | 103,070 |

csgo/filipe: 99.01% of canonical rows pass validation. This is a consistency pass rate, not a coverage rate.
cs2/ektarr: 83.48% of canonical rows pass validation. This is a consistency pass rate, not a coverage rate.

Database QA uses **PRAGMA quick_check plus separate logical, foreign-key and uniqueness checks**. A full **PRAGMA integrity_check was not completed**; no completed full physical/index integrity audit is claimed. See the [validation report](validation-report.md) for executed check results.

21/21 database invariants passed. An independent implementation checked 811 sampled actual window memberships/counts and 34 prior-only reference distributions; 0 failures. These samples do not certify every constituent window or source observation.

Wholly missing calendar years: 2022. Populated periods have usable observations, but no period is demonstrated to be a census of all professional competition. The 2021-05-31–2023-10-24 gap excludes late CS:GO careers as well as the initial CS2 transition. Unequal source validation attrition can bias cross-game comparisons.

## Highest observed raw peaks

Each table entry is the KPR leader in its own game/opposition/window cohort. KPR = total kills / total player-round denominator. Net KPR = (kills − deaths) / rounds. Primary exposure is inferred from complete map scoreboards; exact demo participation remains unverified.

| Game | Opposition | Maps | KPR leader | KPR | Net KPR in same window | Peak dates | Rounds | Source/window reference |
|---|---|---:|---|---:|---:|---|---:|---|
| cs2 | all | 10 | Donk (hltv:21167) | 1.174 | 0.612 | 2026-05-16–2026-06-11 | 178 | window 1286018; ektarr:cs2_all_tiers_games.csv:4299:team2_player1 |
| cs2 | all | 25 | Donk (hltv:21167) | 1.042 | 0.399 | 2023-12-09–2024-02-19 | 506 | window 1305296; ektarr:cs2_all_tiers_games.csv:23166:team2_player5 |
| cs2 | all | 50 | Donk (hltv:21167) | 0.997 | 0.324 | 2023-12-10–2024-05-27 | 1,056 | window 1150157; ektarr:cs2_all_tiers_games.csv:23155:team1_player5 |
| cs2 | all | 100 | Donk (hltv:21167) | 0.970 | 0.306 | 2024-12-05–2025-07-28 | 2,179 | window 1400351; ektarr:cs2_all_tiers_games.csv:14700:team1_player4 |
| cs2 | all | 200 | ZywOo (hltv:11893) | 0.841 | 0.262 | 2025-04-23–2026-04-19 | 4,367 | window 1421972; ektarr:cs2_all_tiers_games.csv:11692:team1_player2 |
| cs2 | elo_top30 | 10 | Donk (hltv:21167) | 1.139 | 0.531 | 2024-02-03–2024-02-19 | 194 | window 863384; ektarr:cs2_all_tiers_games.csv:22292:team2_player4 |
| cs2 | elo_top30 | 25 | Donk (hltv:21167) | 1.041 | 0.410 | 2023-12-07–2024-02-19 | 517 | window 913301; ektarr:cs2_all_tiers_games.csv:23230:team2_player5 |
| cs2 | elo_top30 | 50 | Donk (hltv:21167) | 0.978 | 0.319 | 2023-12-08–2024-05-29 | 1,061 | window 830051; ektarr:cs2_all_tiers_games.csv:23188:team1_player5 |
| cs2 | elo_top30 | 100 | Donk (hltv:21167) | 0.956 | 0.286 | 2024-12-05–2025-08-03 | 2,225 | window 962707; ektarr:cs2_all_tiers_games.csv:14700:team1_player4 |
| cs2 | elo_top30 | 200 | NiKo (hltv:3741) | 0.737 | 0.078 | 2024-05-28–2025-05-25 | 4,316 | window 974021; ektarr:cs2_all_tiers_games.csv:19588:team1_player1 |
| csgo | all | 10 | BnTeT (hltv:7131) | 1.195 | 0.621 | 2016-10-08–2016-10-14 | 256 | window 169866; filipe:match_players.csv:706228: |
| csgo | all | 25 | BnTeT (hltv:7131) | 1.081 | 0.493 | 2016-10-07–2016-11-27 | 604 | window 3849775; filipe:match_players.csv:916346: |
| csgo | all | 50 | BnTeT (hltv:7131) | 1.035 | 0.454 | 2016-09-28–2017-03-18 | 1,210 | window 3201350; filipe:match_players.csv:575481: |
| csgo | all | 100 | BnTeT (hltv:7131) | 0.971 | 0.368 | 2016-06-17–2017-04-20 | 2,439 | window 4540128; filipe:match_players.csv:221815: |
| csgo | all | 200 | GeT_RiGhT (hltv:39) | 0.906 | 0.372 | 2012-11-02–2013-08-17 | 4,744 | window 4921781; filipe:match_players.csv:875708: |
| csgo | elo_top30 | 10 | f0rest (hltv:29) | 1.090 | 0.603 | 2013-03-29–2013-04-04 | 234 | window 1893517; filipe:match_players.csv:574089: |
| csgo | elo_top30 | 25 | GeT_RiGhT (hltv:39) | 0.980 | 0.474 | 2012-11-24–2013-02-07 | 548 | window 2089853; filipe:match_players.csv:674451: |
| csgo | elo_top30 | 50 | s1mple (hltv:7998) | 0.937 | 0.340 | 2018-04-04–2018-07-03 | 1,341 | window 1833380; filipe:match_players.csv:909116: |
| csgo | elo_top30 | 100 | s1mple (hltv:7998) | 0.906 | 0.301 | 2017-11-11–2018-05-19 | 2,675 | window 2323590; filipe:match_players.csv:88948: |
| csgo | elo_top30 | 200 | s1mple (hltv:7998) | 0.880 | 0.288 | 2017-11-08–2018-11-07 | 5,311 | window 2380496; filipe:match_players.csv:167109: |

All figures are observed maxima, not estimates of unobserved peaks. Window bounds, component counts and provenance anchors are in the [research JSON download](https://raw.githubusercontent.com/BoomerRawlings/boomerrawlings.com/main/datasets/apex/e99a936a6367a680/research.json.gz). Complete constituent membership is recoverable from the canonical database; the JSON includes full provenance-reference lists for selected 50-map uncertainty cases, not every ranked window.

## Contemporary-relative dominance and model sensitivity

References use the latest same-size window per observed player, same game and opposition cohort, completed in the preceding 365 days and strictly before the endpoint day; minimum 20 reference players. PPI = 100 + 10 × (z_KPR + z_NetKPR)/2. It is a candidate index, not validated round-winning contribution and not necessarily SD 10.

| Game | Opposition | 50-map metric | Observed leader | Value | Peak dates | Rounds | Reference players |
|---|---|---|---|---:|---|---:|---:|
| cs2 | all | kpr | Donk | 0.997 | 2023-12-10–2024-05-27 | 1,056 | 156 |
| cs2 | all | net_kpr | ZywOo | 0.394 | 2026-02-02–2026-04-29 | 1,088 | 300 |
| cs2 | all | z_kpr | Donk | 6.274 | 2023-10-27–2024-03-08 | 1,059 | 46 |
| cs2 | all | z_net_kpr | ZywOo | 4.852 | 2026-02-02–2026-04-29 | 1,088 | 300 |
| cs2 | all | ppi | Donk | 151.826 | 2023-10-27–2024-03-08 | 1,059 | 46 |
| cs2 | all | ppi_defense | ZywOo | 138.483 | 2026-02-02–2026-04-29 | 1,088 | 300 |
| cs2 | all | ppi_covariance | ZywOo | 147.778 | 2026-02-02–2026-04-29 | 1,088 | 300 |
| cs2 | all | ppi_offense75 | Donk | 146.505 | 2023-10-27–2024-03-08 | 1,059 | 46 |
| cs2 | all | ppi_survival75 | ZywOo | 136.686 | 2025-12-11–2026-03-28 | 1,075 | 304 |
| cs2 | all | adr | Donk | 102.290 | 2023-12-10–2024-05-27 | 1,056 | 156 |
| cs2 | elo_top30 | kpr | Donk | 0.978 | 2023-12-08–2024-05-29 | 1,061 | 45 |
| cs2 | elo_top30 | net_kpr | ZywOo | 0.361 | 2025-12-14–2026-04-29 | 1,081 | 186 |
| cs2 | elo_top30 | z_kpr | Donk | 4.867 | 2024-12-06–2025-03-21 | 1,071 | 157 |
| cs2 | elo_top30 | z_net_kpr | ZywOo | 4.378 | 2025-12-14–2026-04-29 | 1,081 | 186 |
| cs2 | elo_top30 | ppi | Donk | 142.838 | 2025-03-07–2025-07-28 | 1,128 | 175 |
| cs2 | elo_top30 | ppi_defense | ZywOo | 135.319 | 2025-12-14–2026-04-29 | 1,081 | 186 |
| cs2 | elo_top30 | ppi_covariance | ZywOo | 143.460 | 2025-12-14–2026-04-29 | 1,081 | 186 |
| cs2 | elo_top30 | ppi_offense75 | ZywOo | 136.932 | 2025-12-14–2026-04-29 | 1,081 | 186 |
| cs2 | elo_top30 | ppi_survival75 | ZywOo | 133.707 | 2025-12-14–2026-04-29 | 1,081 | 186 |
| cs2 | elo_top30 | adr | Donk | 100.912 | 2023-11-21–2024-05-19 | 1,079 | 35 |
| csgo | all | kpr | BnTeT | 1.035 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | all | net_kpr | GeT_RiGhT | 0.455 | 2012-11-03–2013-01-29 | 1,128 | 7 |
| csgo | all | z_kpr | BnTeT | 5.318 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | all | z_net_kpr | BnTeT | 5.513 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | all | ppi | BnTeT | 154.158 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | all | ppi_defense | BnTeT | 141.837 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | all | ppi_covariance | BnTeT | 152.211 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | all | ppi_offense75 | BnTeT | 147.510 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | all | ppi_survival75 | sh1ro | 144.635 | 2020-10-09–2020-11-24 | 1,262 | 1080 |
| csgo | all | adr | BnTeT | 107.136 | 2016-09-28–2017-03-18 | 1,210 | 760 |
| csgo | elo_top30 | kpr | s1mple | 0.937 | 2018-04-04–2018-07-03 | 1,341 | 283 |
| csgo | elo_top30 | net_kpr | GeT_RiGhT | 0.399 | 2012-11-19–2013-03-05 | 1,139 | 0 |
| csgo | elo_top30 | z_kpr | s1mple | 4.581 | 2018-04-04–2018-07-03 | 1,341 | 283 |
| csgo | elo_top30 | z_net_kpr | s1mple | 4.552 | 2018-04-04–2018-07-03 | 1,341 | 283 |
| csgo | elo_top30 | ppi | s1mple | 145.667 | 2018-04-04–2018-07-03 | 1,341 | 283 |
| csgo | elo_top30 | ppi_defense | s1mple | 135.136 | 2018-04-04–2018-07-03 | 1,341 | 283 |
| csgo | elo_top30 | ppi_covariance | s1mple | 143.128 | 2018-04-04–2018-07-03 | 1,341 | 283 |
| csgo | elo_top30 | ppi_offense75 | s1mple | 140.474 | 2018-04-04–2018-07-03 | 1,341 | 283 |
| csgo | elo_top30 | ppi_survival75 | Jame | 137.548 | 2018-10-25–2019-03-18 | 1,359 | 294 |
| csgo | elo_top30 | adr | XANTARES | 98.355 | 2016-07-14–2017-01-14 | 1,290 | 235 |

| Game | Opposition | 50-map correlation: KPR vs Net KPR | KPR vs −DPR |
|---|---|---:|---:|
| cs2 | all | 0.889 | 0.260 |
| cs2 | elo_top30 | 0.905 | 0.280 |
| csgo | all | 0.891 | 0.247 |
| csgo | elo_top30 | 0.897 | 0.292 |

Alternative reference horizons rerun the same 50-map endpoint observations and retain the 20-player minimum and strict prior-day cutoff. Top-10 overlap measures membership, not statistical certainty.

| Game | Opposition | Reference days | PPI leader | PPI | Peak dates | Top-10 overlap with 365 days |
|---|---|---:|---|---:|---|---:|
| cs2 | all | 90 | Donk | 151.826 | 2023-10-27–2024-03-08 | 10/10 |
| cs2 | all | 180 | Donk | 151.826 | 2023-10-27–2024-03-08 | 10/10 |
| cs2 | elo_top30 | 90 | Donk | 141.006 | 2025-03-07–2025-07-28 | 9/10 |
| cs2 | elo_top30 | 180 | Donk | 142.145 | 2024-12-05–2025-03-15 | 9/10 |
| csgo | all | 90 | BnTeT | 153.642 | 2016-09-28–2017-03-18 | 9/10 |
| csgo | all | 180 | BnTeT | 154.054 | 2016-09-28–2017-03-18 | 9/10 |
| csgo | elo_top30 | 90 | s1mple | 145.032 | 2018-04-04–2018-07-03 | 10/10 |
| csgo | elo_top30 | 180 | s1mple | 145.773 | 2018-04-04–2018-07-03 | 10/10 |

Correlations are descriptive; overlapping windows are not independent observations. The KPR/Net KPR candidate reuses kill production algebraically. Weighting and covariance alternatives in the machine-readable report show specification sensitivity without tuning toward a preferred player. No unimplemented role/causal adjustment is implied.

## Named-player comparisons

These aliases were requested validation targets, not a collection filter. Rank is each candidate identity's **50-map KPR personal peak** within its displayed cohort; a missing entry means unavailable or ineligible, not inferior. Case-insensitive alias lookup also finds Nikolaj Kristensen: he is explicitly labeled separately from Nikola Kovač, not merged with him.

| Alias | Source identity | Game | Opposition | KPR rank | Peak KPR | Peak dates | Rounds |
|---|---|---|---|---:|---:|---|---:|
| GeT_RiGhT | hltv:39 | csgo | all | 2/2154 | 0.978 | 2012-11-24–2013-02-20 | 1,123 |
| GeT_RiGhT | hltv:39 | csgo | elo_top30 | 2/545 | 0.924 | 2012-11-19–2013-03-05 | 1,139 |
| f0rest | hltv:29 | csgo | all | 9/2154 | 0.924 | 2013-02-24–2013-04-14 | 1,188 |
| f0rest | hltv:29 | csgo | elo_top30 | 3/545 | 0.920 | 2013-03-21–2013-06-12 | 1,230 |
| kennyS | hltv:7167 | csgo | all | 20/2154 | 0.907 | 2014-07-16–2014-09-29 | 1,255 |
| kennyS | hltv:7167 | csgo | elo_top30 | 11/545 | 0.856 | 2014-10-09–2015-02-07 | 1,286 |
| GuardiaN | hltv:2757 | csgo | all | 33/2154 | 0.895 | 2015-09-10–2015-11-06 | 1,275 |
| GuardiaN | hltv:2757 | csgo | elo_top30 | 17/545 | 0.841 | 2015-09-15–2015-12-06 | 1,312 |
| shox | hltv:1225 | csgo | all | 45/2154 | 0.887 | 2013-09-22–2013-11-29 | 1,270 |
| shox | hltv:1225 | csgo | elo_top30 | 8/545 | 0.863 | 2016-04-20–2016-07-06 | 1,281 |
| olofmeister | hltv:885 | csgo | all | 19/2154 | 0.909 | 2015-05-24–2015-07-04 | 1,243 |
| olofmeister | hltv:885 | csgo | elo_top30 | 4/545 | 0.906 | 2015-06-01–2015-07-05 | 1,250 |
| coldzera | hltv:9216 | csgo | all | 46/2154 | 0.886 | 2016-05-24–2016-09-21 | 1,239 |
| coldzera | hltv:9216 | csgo | elo_top30 | 15/545 | 0.844 | 2016-03-29–2016-05-25 | 1,332 |
| device | hltv:7592 | cs2 | all | 71/418 | 0.758 | 2025-04-14–2025-07-25 | 1,084 |
| device | hltv:7592 | cs2 | elo_top30 | 54/255 | 0.740 | 2025-04-16–2025-09-16 | 1,093 |
| device | hltv:7592 | csgo | all | 113/2154 | 0.858 | 2015-09-22–2015-10-29 | 1,272 |
| device | hltv:7592 | csgo | elo_top30 | 14/545 | 0.850 | 2016-11-23–2017-03-01 | 1,280 |
| NiKo (Nikola Kovač) | hltv:3741 | cs2 | all | 19/418 | 0.808 | 2024-11-22–2025-03-07 | 1,108 |
| NiKo (Nikola Kovač) | hltv:3741 | cs2 | elo_top30 | 10/255 | 0.801 | 2024-04-28–2024-08-12 | 1,043 |
| NiKo (Nikola Kovač) | hltv:3741 | csgo | all | 75/2154 | 0.874 | 2015-09-29–2015-12-15 | 1,371 |
| niko (Nikolaj Kristensen; distinct player) | hltv:10264 | csgo | all | 228/2154 | 0.830 | 2015-11-30–2016-06-14 | 1,292 |
| NiKo (Nikola Kovač) | hltv:3741 | csgo | elo_top30 | 6/545 | 0.870 | 2015-09-28–2016-01-23 | 1,330 |
| niko (Nikolaj Kristensen; distinct player) | hltv:10264 | csgo | elo_top30 | 120/545 | 0.767 | 2016-11-27–2017-04-30 | 1,360 |
| s1mple | hltv:7998 | cs2 | all | 7/418 | 0.838 | 2025-06-10–2025-10-22 | 1,066 |
| s1mple | hltv:7998 | csgo | all | 6/2154 | 0.942 | 2018-02-24–2018-05-15 | 1,339 |
| s1mple | hltv:7998 | csgo | elo_top30 | 1/545 | 0.937 | 2018-04-04–2018-07-03 | 1,341 |
| ZywOo | hltv:11893 | cs2 | all | 2/418 | 0.925 | 2026-02-02–2026-04-29 | 1,088 |
| ZywOo | hltv:11893 | cs2 | elo_top30 | 2/255 | 0.907 | 2024-11-17–2025-03-30 | 1,035 |
| ZywOo | hltv:11893 | csgo | all | 3/2154 | 0.973 | 2017-07-27–2017-11-11 | 1,295 |
| ZywOo | hltv:11893 | csgo | elo_top30 | 9/545 | 0.863 | 2019-09-05–2019-12-22 | 1,266 |
| m0NESY | hltv:19230 | cs2 | all | 5/418 | 0.867 | 2024-01-22–2024-04-12 | 1,096 |
| m0NESY | hltv:19230 | cs2 | elo_top30 | 3/255 | 0.848 | 2024-08-11–2024-11-22 | 1,026 |
| m0NESY | hltv:19230 | csgo | all | 211/2154 | 0.833 | 2021-03-27–2021-05-30 | 1,252 |
| donk | hltv:21167 | cs2 | all | 1/418 | 0.997 | 2023-12-10–2024-05-27 | 1,056 |
| donk | hltv:21167 | cs2 | elo_top30 | 1/255 | 0.978 | 2023-12-08–2024-05-29 | 1,061 |

## Exposure and uncertainty

Whole-event and, where genuine series IDs exist, whole-match bootstrap results for selected observed 50-map leaders are included in research.json. Event intervals require ≥8 clusters; unavailable estimates remain unavailable. Filipe mapstats containers cannot support match-cluster intervals. Match intervals retain within-match maps but do not retain between-match tournament dependence. Neither interval adjusts for selecting a maximum, missing sources or alternative-specification search.

| Game | Opposition | Players with ≥200 observed qualifying maps | Players with an admissible matched window | Median full-career minus first-200 KPR peak |
|---|---|---:|---:|---:|
| csgo | all | 1120 | 1120 players | 0.000 |
| cs2 | all | 169 | 169 players | 0.000 |
| csgo | elo_top30 | 289 | 289 players | 0.000 |
| cs2 | elo_top30 | 90 | 90 players | 0.000 |

First 200 **observed** maps equalizes recorded exposure, not actual career opportunity. Source-start censoring, career stage and survival to 200 maps remain. A zero median does not mean every player's full-career and matched peaks are equal or that opportunity bias is absent. The table does not estimate how much of a player's skill is luck.

## Comparable measurements and remaining uncertainty

KPR, DPR and Net KPR can be computed consistently from acquired underlying counts; no metric has demonstrated complete 2012–present coverage. Round exposure is scoreboard-derived and conditional on valid full-roster maps. ADR requires full-map coverage and may use rounded published map values. Published HLTV rating versions are not pooled. Missing roles, economics, side context and exact patch metadata prevent a validated cross-era contribution model.

- Published contemporary top-30 history is unverified/unavailable; the requested primary specification is not established.
- All-source and reconstructed-Elo alternatives remain separate, explicitly labeled analyses.
- Kills, deaths and map-score-derived rounds permit ratios only within observed full-roster maps; exact individual participation is assumed, not demo-verified.
- Era gaps, unrecorded competition, source selection and missing-not-at-random mechanisms prevent an all-history census claim.
- CS:GO and CS2 windows and relative-reference populations are separate; equal raw output does not establish equal skill.
- Unresolved cross-source identity links and roster-derived team lineages are not verified unique people or organizations.
- Roles, resources, map/economy balance, round-winning contribution and fully adjusted opponent effects are not identified.
- Repeated and overlapping windows, peak selection, unequal career exposure and regression to the mean limit inferential claims.
- Conditional cluster intervals are not selection-adjusted uncertainty for the best historical peak.
- Database QA uses PRAGMA quick_check plus separate logical, foreign-key and uniqueness checks; a full PRAGMA integrity_check was not completed.
- Role/map/stage/resource adjustments, ADR-inclusive composite fitting, causal round contribution, age trajectories, true elite-duration estimates, and selection-adjusted peak inference are not implemented.

## Conclusions and next data

Robust: arithmetic, fixed specifications, provenance and observed-data rankings are reproducible. Uncertain: true historical maxima, cross-era skill equivalence, a universally best PPI, and selected-maximum uncertainty. Different leaders under different columns are evidence of model dependence, not a reason to choose a preferred definition.

- Licensed player-map records for uncovered dates, regions and events, including currently missing years.
- Dated pre-match published ranking snapshots and organizer/event-strength metadata.
- Verified source-to-source player/team identity links and official historical roster records.
- Professional demos with exact player rounds, damage, side, weapon, opening, trade, economy and role context.
- Independently verified match samples across eras, including target players and historical Majors.

See [methodology](methodology.md), source inventory, validation report and canonical database for definitions and source assessment. This generated report does not replace independent-source reconciliation.

## Source references

- [ektarr](https://www.kaggle.com/datasets/ektarr/counter-strike-pro-matches), pinned version 12; publisher-declared CC BY-SA 4.0; acquired 2026-11-27T09:57:10.229Z. Immutable manifest: `data/raw/ektarr/v12/manifest.json`.
- [filipe](https://www.kaggle.com/datasets/filipechavesdemacedo/counter-strike-competitive-data), pinned version 1; publisher-declared CC BY 4.0; acquired 2026-11-27T09:59:23.957Z. Immutable manifest: `data/raw/filipe/v1/manifest.json`.
- [machado](https://www.kaggle.com/datasets/mateusdmachado/csgo-professional-matches), pinned version 1; publisher-declared CC BY-NC-SA 4.0; acquired 2026-11-27T09:56:08.240Z. Immutable manifest: `data/raw/machado/v1/manifest.json`.

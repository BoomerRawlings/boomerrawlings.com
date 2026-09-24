# Independent sources for the crime-and-heat study

Source-validation supplement, 24 September 2026. This adds official data, source documentation and independent checks. The published arrest-record coefficients, p-values and existing PDF remain unchanged. No additional effect model is estimated.

## Material reporting evidence

California DOJ identifies incomplete San Diego County Sheriff submissions for **November–December 2024 and January–June 2025**, in both its arrest and DV-call documentation. The primary analyses exclude 2025 but retain the flagged late-2024 interval. This raises a further interpretation limit. It does not establish the supplied export's exact missing records, reporting mechanism or completeness percentage. A reporting entity's row may exist even when its submission is incomplete. The retained original release also includes an explicitly exploratory July–December 2025 DV model; it is not a primary result.

Sources: [DOJ arrest context, p. 7](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Arrests%20Context_0615026.pdf#page=7), [DOJ DV context, p. 5](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Domestic%20Violence%20Related%20Calls%20for%20Service%20Context_06222026.pdf#page=5). See the [DOJ source audit](doj/DOJ_BENCHMARKS.md) for exact scope and separately named contract-city entities.

## Acquired sources

| Source | Coverage | Use and limitation |
|---|---|---|
| [California DOJ](doj/DOJ_BENCHMARKS.md) | County arrests: 1980–2025. Agency DV-call reports: 2001–2025. | Annual arrest/citation totals and monthly DV reports are separate benchmarks. Documented Sheriff reporting gaps; county totals include multiple agencies. |
| [SANDAG / ARJIS CIBRS](local/README.md) | 2021–23 September 2026; agency-specific endpoints vary. | Group A supplies an explicit DV indicator. Group B DV values are all missing. Public releases are described as samples; coverage is not certified. |
| [San Diego Police NIBRS](local/README.md) | 2020–23 September 2026. | Daily reported offense counts for a different jurisdiction. Distinct offense identifiers are reconciled; incident counts cannot be summed across offense categories. |
| [SANDAG historical DV series](local/README.md) | 37 annual values, 1986–2022. | The actual downloaded years differ from the chart title. Historical context only; do not splice to modern incident data or use annual totals for daily heat inference. |
| [NOAA daily stations](weather/README.md) | 29 stations; 1991–2025 archive extract. | 25 stations meet the 2021–2024 maximum-temperature coverage rule. Six support a 1991–2020 warm-season baseline. Observation days differ from civil days. |
| [NOAA subdaily observations](weather/README.md) | 12 stations; 2021–2024. | 379,574 accepted hourly samples; 13,235 complete station-days. High and low are sampled extrema; means require every civil hour. |
| [Census municipal context](context/GEOGRAPHIC_CONTEXT.md) | 2020 population for nine Sheriff contract cities. | Population context only. Ambiguous recorded localities and agency coverage prevent municipal arrest-risk denominators. |

## What the acquisition establishes

The public SANDAG Group A snapshot contains 791,760 rows representing 624,649 agency-scoped incident identifiers, including 66,681 DV-flagged incidents. The Sheriff subset contains 133,003 incidents, including 15,513 DV-flagged incidents, through 22 September 2026. These are reported-incident identifiers, not independently verified occurrences, unique victims or the study's arrest groups. DV classification is an officer-recorded indicator in this source and is not equivalent to the original charge-code screen. Group B's DV column is entirely null: it cannot furnish a DV-arrest series. SDPD's seven annual offense files contribute 549,408 rows; daily and monthly aggregates reconcile. Its CAD release excludes DV and other sensitive calls, so it cannot validate DV completeness. [Local source audit](local/README.md).

For weather, 25 of the 29 downloaded daily stations meet the 90% primary-period maximum-temperature coverage criterion. The specified nearest-station rule, followed by distance and elevation restrictions, matches 94 of 112 ZIPs and 136,243 ZIP-days. Within the corrected 64-ZIP subset, 54 ZIPs have daily-station matches. The six stations qualifying for a 1991–2020 May–September baseline support exploratory 90th/95th-percentile thresholds, not official heat alerts or calendar-day percentiles. This baseline predates the primary 2021–2024 model period, while overlapping the descriptive 2018–2020 records. [Weather source audit](weather/README.md).

Subdaily observations provide a separate civil-day check: 12 stations, 379,574 quality-accepted hourly samples and 13,235 complete station-days. Five stations meet the 90% complete-day criterion used for spatial matching. High/low are hourly sampled extrema; mean is the arithmetic mean of the selected hourly samples. These are not continuous measured extrema or a high/low midpoint. Missing hours remain visible; incomplete days do not receive primary summary temperatures. Independent code recomputes all complete daily summaries and daylight-saving boundaries. [Independent checks](independent_validation.json).

The source expansion does not replace unavailable reanalysis ZIPs with station values inside the existing model panel. Measurement method, station coverage and observation-day conventions remain explicit. Pooled weather differences reuse stations across ZIPs and are descriptive; they are not independent replicate observations.

## Geographic interpretation and prior research

The [municipal context audit](context/GEOGRAPHIC_CONTEXT.md) confirms similar 2020 populations in Vista (98,381) and San Marcos (94,833). Their recorded totals cannot be converted to municipal risk without resolving geographic and agency coverage. This source review does not establish why Vista's supplied count is larger.

The [primary research review](RESEARCH_CONTEXT.md) distinguishes published studies of daily crime, DV calls, heat waves and survey-reported victimization. Positive associations in other studies neither invalidate the local inconclusive estimate nor repair local missingness. This is a targeted source review, not a systematic review.

## Verification, reproduction and remaining work

`independent_validation.json` separately reconciles SANDAG partitions, SDPD daily/monthly totals, DOJ monthly/annual sums, reporting flags, station quality rules and every complete ISD daily temperature summary. Source-specific checks supply additional coverage, duplicate-key and anomaly audits. `publication_validation.json` verifies packaged hashes, aggregate-only crime fields and preservation of all 166 prior artifacts. Source completeness itself cannot be verified from these checks.

The archive retains separate source folders, processing scripts, portable comparison inputs and retrieval hashes. DOI/source links lead to the original documentation. Large raw station archives and statewide DOJ bulk files remain available upstream; acquisition scripts verify the frozen source hashes. The local crime snapshot is a live public release: new retrievals may change. See each folder's reproduction instructions before rerunning acquisition. No personal names, case identifiers, exact incident addresses or raw arrest records are included.

Further outcome models require a frozen counting unit, date and geographic definitions, source-completeness exclusions, lag/heat-wave hypotheses and multiplicity family. A reporting-gap sensitivity should omit November–December 2024 and report its result regardless of significance. It would assess dependence on those months, not prove the remaining records complete. The source dictionary and agency export crosswalk remain unavailable; no new agency request or email was sent.

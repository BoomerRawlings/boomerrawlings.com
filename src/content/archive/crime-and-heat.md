---
title: Heat and arrest records
slug: crime-and-heat
type: data-analysis
date: 2026-09-24
status: published
description: An observational study of supplied San Diego-area arrest records, with corrected civil-day weather, sensitivity analyses, interactive aggregates, and a domestic-violence report.
tags: [Crime, Temperature, Public records, San Diego County, Domestic violence]
---

## Question, outcome and scope

Do hotter dates coincide with more eligible arrest-record groups in the supplied San Diego-area exports? The outcome is **administrative arrest-record activity**. It does not measure all crime, victimization, calls for service, unique people, convictions or verified offenses occurring that day. Reporting, police response, enforcement and recordkeeping all intervene between offending and an arrest record.

The original full-sample 2021–2024 reference remains available: **58,770 eligible groups**, 106 fitted ZIPs and 154,866 ZIP-days; **+1.87% per 10°F**, 95% CI **−0.05% to +3.83%**, two-sided **p = 0.05608**. This is inconclusive at 0.05. The original core-DV reference is **+2.89%**, 95% CI **−1.05% to +6.98%**, **p = 0.15258**, from 6,637 groups. Nonsignificance does not establish equivalence or prove no association. [Original general results](/data-analysis/crime-and-heat/data/crime_model_results.json), [original DV results](/data-analysis/crime-and-heat/data/downloads/model_results.csv).

## Methodological amendment and sample restriction

The amendment corrects weather-day alignment and evaluates a fixed set of robustness checks. The initial estimates and feedback were already known when the plan was written; this remains retrospective analysis, not preregistration. The full plan, acquisition amendment and all results are disclosed. [Revision plan](/data-analysis/crime-and-heat/data/revision-2/PLAN.md), [coverage amendment](/data-analysis/crime-and-heat/data/revision-2/PRE_ESTIMATE_COVERAGE_AMENDMENT.md), [issue-by-issue response](/data-analysis/crime-and-heat/data/revision-2/ISSUE_RESOLUTION.md).

The weather provider reached its daily acquisition quota after **64 of 112 ZIPs** had complete hourly temperature and humidity data. Those 64 also have complete precipitation and prior-day exposures. They contain **57,903 of 58,770 general groups (98.5%)** and **6,501 of 6,637 core-DV groups (98.0%)** in the original eligible sample. Acquisition availability is not random. Missing ZIPs are listed; their weather was not imputed or mixed with the corrected series. The original 112-ZIP data remain an explicitly historical download.

The revised base panel contains **93,504 ZIP-days: 64 ZIPs × 1,461 dates**. Individual model samples can be smaller, as documented in the results. Comparing original weather with corrected weather on these same ZIPs isolates the exposure substitution from sample composition. Comparing either restricted estimate directly with the original full-sample estimate also changes geography. The revised daily explorer uses the 64 corrected ZIPs; the record explorer continues to summarize the full supplied release. [Sample metadata](/data-analysis/crime-and-heat/data/revision-2/panel_metadata.json), [weather acquisition and verification](/data-analysis/crime-and-heat/data/revision-2/weather_revision_provenance.json).

## Records, provenance and classification

The three CSVs contain 214,745 rows. Four invalid rows are excluded, leaving **214,741 charge lines**, including 926 exact duplicates. Grouping identifiers within their originating export produces **136,313 source-ID groups**, so additional charges or identical lines do not automatically add records. This unit is not independently validated as one arrest, person or offense. [Original source reconstruction](/data-analysis/crime-and-heat/data/source_records_audit.json).

| Export | Identifier header | Recorded date header |
|---|---|---|
| July 2018–December 2023 | Incident Number | Incident Date_Time |
| 2024 | Incident Number | Arrest Date/Time |
| 2025 | Arrest Ref Nbr | Arrest Date/Time |

The identifier changes in **2025**, not 2024. Every 2024 and 2025 charge row has Agency = SHERIFF; the older file has no Agency column. These observed labels do not authenticate the release or establish its query, completeness or municipal coverage. No matching agency response letter, extraction specification or export-specific dictionary was located. [Provenance review and exact headers](/data-analysis/crime-and-heat/data/revision-2/PROVENANCE_RESOLUTION.md).

Official Sheriff monthly arrest reports use exclusions for detention, court and non-Sheriff activity, PC 849.5 detentions and records still under review. Their units and filters cannot be equated to these exports without an agency crosswalk. Candidate-filter comparisons are documented without claiming a completeness percentage. Regional NetRMS hosting also does not establish which agencies an export includes. [Official July 2023 activity report](https://www.sdsheriff.gov/home/showpublisheddocument/7134/638284887953100000), [comparison table](/data-analysis/crime-and-heat/data/revision-2/official_monthly_context_comparison.csv).

Groups with conflicting metadata remain flagged: 37 conflict on year, 121 on month, 172 on date and 419 on ZIP. Conflict counts overlap. Exposure assignment requires an unambiguous recorded date and ZIP; no arbitrary first value resolves a conflict. The locality label SHERIFF is administrative, not a city. City totals lack harmonized agency coverage and population denominators.

Selected charge categories are **nonexclusive**: core DV, drug/paraphernalia, property-related, other assault/battery/threats, weapons and driving-related. One group may enter several categories. Their counts cannot be added as unique events, and they are not FBI violent/property-crime classifications. Charges are allegations. [Exact rules and statutory sources](/data-analysis/crime-and-heat/data/category_mapping.csv), [category definitions](/data-analysis/crime-and-heat/data/categories_summary.json).

## Eligibility and warrants

The reference includes exclusively ADULT groups with unique usable dates and ZIPs, matched weather, no warrant subtype and no detention/court command or area classification. The supplied period starts July 2018; no 2026 file exists. **2025 is excluded from all reference and revision models**: 79 dates have no raw source rows, and early-year sparsity is not evidence of zero arrests. Continuous dates in other years still do not prove completeness.

An expanded warrant screen checks every co-charge against the reviewed exact warrant codes. In the full original primary sample, it removes **5,781 general groups and 67 primary core-DV groups**, leaving 52,989 and 6,570. In the 64-ZIP revision sample it removes **5,700 general and 66 core-DV groups**, leaving **52,203 and 6,435**. Original and stricter samples are both reported; the stricter result is not substituted because of its p-value. The screen deliberately retains the statutory “without warrant” counterexample. It does not identify every delayed arrest or verify offense timing. [Warrant audit](/data-analysis/crime-and-heat/data/revision-2/warrant_mask_summary.json), [exact code list](/data-analysis/crime-and-heat/data/revision-2/warrant_charge_audit.csv).

## Civil-day weather and exposure uncertainty

Revised temperatures come from **ERA5-Land hourly data**, requested at the same Census ZCTA representative points and elevations as the original analysis. UTC timestamps are grouped into America/Los_Angeles civil dates using historical timezone rules. High and low are hourly extrema; mean is the arithmetic mean of all 23, 24 or 25 hourly values in that local date. Humidity uses the same hourly source. Precipitation is explicitly from the coarser **ERA5** product because this provider's ERA5-Land precipitation field was unavailable. Hourly precipitation accumulations are assigned by their interval endpoints. [Open-Meteo documentation](https://open-meteo.com/en/docs/historical-weather-api), [ERA5-Land](https://doi.org/10.24381/cds.e2161bac), [Census Gazetteer](https://www.census.gov/geographies/reference-files/2024/geo/gazetter-file.html).

The original daily API used fixed UTC−7. The starting midnight differs on **509 primary-period dates**; comparing both boundaries identifies **513 changed day windows**, including four spring and four autumn transition dates. Spring and autumn boundary tests and independent regrouping verify the revised series. The 64 ZIPs share **37 temperature grids** and **15 precipitation grids**; they are not 64 independent weather instruments. [Weather validation](/data-analysis/crime-and-heat/data/revision-2/verification.json), [temperature differences](/data-analysis/crime-and-heat/data/revision-2/temperature_difference_summary.csv).

The original six-station comparison found daily-maximum mean absolute differences of 2.6–5.9°F, and a modeled-minimum warm bias of 6.8°F at Ramona. Model error, elevation, grid smoothing and observation-day conventions contribute. These values are agreement checks, not a correction formula for every ZIP. Revised station sensitivities assign the geographically nearest of the six stations, then require distance ≤25 km and elevation difference ≤200 m. Quality-invalid or missing station maxima are removed identically from the paired station and modeled-weather fits. [NOAA quality documentation](https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt), [station assignments](/data-analysis/crime-and-heat/data/revision-2/station_assignment.csv).

Same-day maximum can occur after a morning record. Previous-day maximum is therefore examined separately. Neither day alignment nor lagging can establish an unknown offense date, indoor exposure or personal heat dose. Remaining weather/linkage uncertainty is not included in the model confidence intervals.

## Mean model and uncertainty

The reference mean model is

$$
\begin{aligned}
\log \mu_{zd}
  &= \alpha_z + \gamma_{m(d)} \\
  &\quad + \delta_{w(d)} + \beta\,\frac{T_{zd}-70}{10}, \\
\mu_{zd}
  &= \operatorname{E}\!\left[Y_{zd}\mid\mathbf{x}_{zd}\right].
\end{aligned}
$$

Here, $Y_{zd}$ is the eligible record-group count for ZIP $z$ and recorded date $d$; $\mu_{zd}$ is its conditional expected count; $T_{zd}$ is the specified daily maximum in °F. The functions $m(d)$ and $w(d)$ denote year-month and weekday. The covariates $\mathbf{x}_{zd}$ include temperature and the stated geographic/calendar controls. The count ratio per 10°F is $\exp(\beta)$. Centering at 70°F changes intercepts only.

Poisson is used as a conditional-mean model. Excess variability is addressed with sandwich covariance; many zeros alone do not justify a separate zero-inflated model. Observed and model-implied zero fractions, residual dependence and dispersion are disclosed as diagnostics, not proof of a correct mean specification. ZIPs with zero outcomes throughout a fitted sample are omitted from that fit and remain in descriptive denominators. [Independent methods review](/data-analysis/crime-and-heat/data/revision-2/INDEPENDENT_METHODS_REVIEW.md).

Scores are summed across all ZIPs within each calendar date before Bartlett Newey–West covariance with seven daily lags. All 1,461 dates remain in the score sequence, including dates without station-model rows. Thus, same-day spatial dependence and cross-ZIP lagged dependence enter the covariance; ZIP-days are not assumed independent. The factor $n/(n-k)$ uses fitted rows $n$ and parameters $k$. HAC14 and HAC28 checks are also reported for the corrected reference and combined specification. [Newey and West](https://www.nber.org/papers/t0055), [Driscoll and Kraay](https://doi.org/10.1162/003465398557825).

## Additional controls, nonlinearity and multiplicity

The fixed revision battery adds observed federal holidays, log(1 + daily precipitation in mm), mean relative humidity, and ZIP-specific annual sine/cosine seasonality, separately and together. An elapsed-day offset, $\log(h_d/24)$, is a separate sensitivity: proportional event opportunity across a 23/25-hour day is an assumption, especially when the repeated/lost hour is nighttime.

The nonlinear model replaces the linear temperature term with a restricted cubic spline using four weather-only percentile knots, fixed across outcomes. It reports both the overall temperature test and a separate curvature test. Pointwise curve intervals are not simultaneous bands, and a nonsignificant curvature test does not establish linearity. Specification labels, exact controls, sample sizes, convergence and all tests accompany the results.

ZIP-specific seasonal effects produced exact Poisson separation in two sparse DV ZIPs. A documented extended-MLE calculation removes only certified zero-count rows whose limiting fitted means are zero, retains every positive outcome, and removes seasonal columns then redundant with ZIP intercepts. This numerical correction follows the diagnosed fitting failure; no event-count cutoff or penalty is introduced. Descriptive zero-day denominators remain unchanged. Per-model removal counts and certificates are public. [Numerical amendment](/data-analysis/crime-and-heat/data/revision-2/NUMERICAL_AMENDMENT.md).

The revised plan contains **22 fits and 24 temperature hypotheses across both outcomes**, including same-sample original-weather comparisons. Holm correction covers this entire revision family. Nominal intervals remain individual 95% intervals. All revised tests are exploratory/retrospective; neither nominal significance in one model nor selecting a favorable specification creates confirmatory evidence. Original testing families remain disclosed separately. [Frozen plan and amendment](/data-analysis/crime-and-heat/data/revision-2/PLAN.md), [Holm (1979)](https://www.jstor.org/stable/4615733).

## Denominators and remaining confounding

The estimand concerns **counts per ZIP-day**, not risk per resident. Adding a constant population offset $\log(P_z)$ cannot change the temperature coefficient when unrestricted ZIP intercepts are present: it is absorbed into $\alpha_z$. A Census denominator does not measure daily visitors, commuters or changing police coverage. A total-arrest offset asks a different composition question and could condition on temperature-related enforcement activity.

The new controls address specified calendar and weather differences; they do not establish exchangeability. Tourism, local events, school schedules, staffing, economic conditions, reporting and individual circumstances remain incompletely measured. Some variables may lie on a causal pathway rather than be appropriate controls. The analysis cannot identify the effect of heat on underlying crime or violence.

## Reproducibility and agency-dependent questions

Original hashes and published numerical outputs are retained. Revised weather aggregates, model inputs, estimates, code, diagnostics, station assignments and source references are public; record identifiers, street locations and individual timestamps remain private. Independent numerical checks validate processing, not source authenticity, completeness or external validity. Computational audits are not external human peer review. Reporting follows relevant STROBE and SAMPL principles. [STROBE](https://doi.org/10.1371/journal.pmed.0040296), [SAMPL](https://resources.equator-network.org/reporting-guidelines/sampl/).

A prepared agency request asks for the original extraction/query, agency selection, same-query control totals, source-ID cardinality, timestamp and City/ZIP definitions, schema changes, and the reason for 2025 gaps. It has not been sent. Those questions require documented agency answers; no statistical adjustment can supply them. [Clarification request draft](/data-analysis/crime-and-heat/data/revision-2/AGENCY_CLARIFICATION_DRAFT.md).

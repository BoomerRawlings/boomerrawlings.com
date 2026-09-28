# Exploratory lunar-pattern analysis: fixed specification

27 September 2026 Pacific. Written before this project's first lunar exposure–outcome calculation. This is a local, outcome-unseen specification, **not an externally registered protocol or confirmatory study**. The user requested rough correlations now; this exploratory branch proceeds without representing the earlier registration proposal as completed. Known prior information includes source counts, time span, data limitations and published seasonal/weekday findings. The complete-diary protocol remains a separate future design.

## Data and target

Use only the already verified Clue older-band extract: 3,650 region-days, five regions, 730 consecutive dates (2017-07-01–2019-06-30), birth-control group `all`, age label `> 23`, outcome `all_sex`. The approximate birth-bin selection is adult-only, not exact age24+. Do not combine overlapping age/contraception/outcome series, invent the absent Brazil Northeast older stratum, or include date-ineligible diaries. Newly acquired eligible sources, if any, require separate stated specifications and do not silently enter this model.

Outcome is `log(n/n_any)`: sex-feature logs divided by users with any feature attributed to that calendar date. All selected counts are positive; no pseudocount. Fit unweighted ordinary least squares to balanced region-days: an equally weighted regional pooled regression, not a worldwide population rate or a mean of independent studies. This is a geometric reporting-ratio estimand. Optional logs are not all sexual events or complete observed no-sex days. Unique people and acts cannot be recovered from aggregate rows.

## Astronomical exposure

Skyfield `almanac.moon_phase` with NASA/JPL DE421: apparent geocentric ecliptic longitude difference, new=0°, first quarter=90°, full=180°, last quarter=270°. Calculate at representative local noon using IANA zones: Brazil Central-West `America/Sao_Paulo` (Brasilia convention), France `Europe/Paris`, UK `Europe/London`, California `America/Los_Angeles`, US Northeast `America/New_York`. These are assumptions for broad regional calendar labels, not known participant timestamps or nighttime moonlight. Brazil's region spans more than one zone. Compare representative timestamp minus12h and plus12h.

Validate phase crossings against official US Naval Observatory2018 primary-phase timestamps; archive request, response, phase convention, ephemeris hash and software versions. Target discrepancy under2minutes; stop and diagnose if exceeded. Eight descriptive bins have centers0,45,...315° and half-width22.5°; new-Moon bin wraps across zero. No correlation with a linearly numbered phase angle.

## Fixed regression and calendar terms

Main lunar columns: cosine then sine of phase. For each region, include intercept, six weekday indicators (Monday reference), centered linear calendar trend in years, two annual Fourier harmonics (period365.2425days, anchored2017-01-01), and the event indicators below. Calendar terms are region-specific. Discard exactly all-zero columns; otherwise rank deficiency is a stop-and-diagnose condition, not permission to choose controls after results.

Predefined calendar windows: Christmas December24–26; New Year December31–January1; Valentine's Day February14; Western Easter Friday–Monday for all five regions; Brazil Carnival Monday/Tuesday (Easter minus48/minus47days), US July4, France July14, Brazil September7, and US Thanksgiving Thursday/Friday (fourth NovemberThursday and next day). The last three national-date definitions share one region-specific column, since they never apply in the same region. Dates use Gregorian/dateutil Easter computation; archive the generated calendar. These are limited calendar controls, not every public/religious/local holiday. Easter/Carnival are lunar-calendar-linked; adjusted and unadjusted estimates ask different questions.

Model: log reporting ratio = region-specific calendar terms + a*cos(phase) + b*sin(phase) + residual. Do not include unrestricted exact-date effects, which would remove the shared lunar exposure.

## Inference

Primary exploratory test: joint a=b=0, Wald chi-square with2degrees of freedom, nominal alpha.05. Use date-summed score vectors, including all five regions together, and Bartlett heteroskedasticity/autocorrelation-consistent (HAC) covariance with35 calendar-day lags. Finite multiplier: T/(T−1)*(N−1)/(N−K), where T is observed unique dates, N region-days, K full design rank. This is the statsmodels grouped-score/cluster correction convention; it does not create additional independent dates. Check rank, positive semidefinite covariance and the lunar submatrix.

Report coefficients/covariance, joint p, prespecified full-vs-new contrast100*[exp(−2a)−1] with95% linear-contrast interval, and fitted maximum-vs-minimum contrast100*[exp(2*sqrt(a²+b²))−1]. Obtain the latter's conservative interval by projecting the95% joint coefficient ellipse; lower bound0 when the ellipse contains the origin. A fitted peak is inherently selected and positive amplitude is biased upward under the null. If the joint ellipse contains zero, label peak timing unidentified. Use simultaneous95% lunar-curve bands from the2D coefficient ellipse, not mislabeled pointwise intervals.

Approximate calibration sensitivity: null-imposed dependent wild bootstrap,1,999replicates, NumPy seed20260927,35-day moving-average Gaussian multipliers normalized to unit variance. Each date's same multiplier applies to all five regional null residuals, preserving common-date shocks and fixed design. Fit null calendar-only model, multiply its residuals, add fitted values, refit full model. Recalculate the full-model35-day HAC statistic in each replicate; bootstrap p=(1+number statistics>=observed)/(2000). This is a diagnostic under nuisance-model/dependence assumptions, not exact randomization. No independent row/date shuffle or constant phase rotation.

## Fixed sensitivity family and descriptions

1. Covariance bandwidth14 and60days, same coefficients/design.
2. Four rather than two annual harmonics, otherwise main design.
3. Representative timestamps minus12h and plus12h.
4. Rolling-active-user denominator `log(n/n_users)` and diagnostic `log(n_any/n_users)`, exactly same design. Verify coefficient identity: active-denominator result = any-tracking-denominator result + tracking-fraction result. These are measurement diagnostics, not independent outcomes/replications or controls that eliminate logging bias.
5. Five leave-one-region-out refits.
6. Two study-year fits: July2017–June2018; July2018–June2019. Split at2018-07-01, rather than incomplete calendar years.
7. Five regional fits, same controls/bandwidth. Apply Holm correction across their five joint p-values; do not promote the most favorable subgroup.
8. Calendar-unadjusted fit with region intercepts plus lunar terms, also using35-day grouped-score HAC. This illustrates confounding; it does not replace the selected model.

Report all sensitivities together and treat them as exploratory, without choosing a new primary result. Provide descriptive phase-bin reporting indices, regional/calendar coverage, weekday summaries, and residualized lunar partial R² (improvement in SSE over the calendar-only model). The square root of partial R² may be labelled multiple/circular-regression association magnitude, without a signed Pearson interpretation or causal meaning. No scanning other periods, lags, subsets or outcomes for favorable p-values.

## Limits and outputs

Roughly25 lunar cycles, not3,650 independent exposures. No demographics beyond aggregate stratification, person-level menstrual cycles, partner availability, weather, moonlight or complete holidays can be controlled from these records. The estimated relationship concerns optional reporting in selected app users during2017–2019. No reliable statement about all humans or causal lunar influence follows. Failure to reject does not establish absence; a positive finding needs independent data and repeated-calendar validation.

Save data provenance, plan hash/time, phase/calendar inputs, model outputs and reproducible scripts. Use aggregate charts and a plainly written cited report; no website publication in this exploratory turn. Independent numerical and source/claim review precedes final reporting.

Sources: [Clue source/code](https://github.com/lasy/Seasonality-Public-Repo), [Skyfield phase definition](https://rhodesmill.org/skyfield/almanac.html#phases-of-the-moon), [USNO phases](https://aa.usno.navy.mil/faq/moon_phases), [USNO API](https://aa.usno.navy.mil/data/api), [grouped-score HAC](https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_nw_groupsum.html), [dependent wild bootstrap](https://publish.illinois.edu/xshao/files/2012/11/JASA-DWB.pdf). The [independent phase-blind review](METHODS_REVIEW.md) explains methodological decisions.

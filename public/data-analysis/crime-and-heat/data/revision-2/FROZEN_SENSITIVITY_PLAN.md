# Independent methods review: frozen revision battery

Recorded 24 September 2026, 22:26 UTC, before revised estimates were available to this reviewer. The coordinating analyst approved R0–R6, then R7–R9, before fitting. This is a retrospective amendment prompted by external feedback. Previous estimates were already known; this is neither preregistration nor independent confirmatory evidence.

## Scope and estimand

Analyze 2021–2024 separately for all eligible source-scoped record groups and core domestic-violence groups. Count groups per ZIP and recorded civil date, including zero-count ZIP-days. These outcomes do not measure all crime, unique people, victimization, offense dates, or individual heat exposure. Preserve the original eligibility criteria and released estimates for historical comparison. Retain all-zero ZIPs in descriptive denominators but remove them from their respective fixed-effect fits, documenting counts.

R0 is the amended reference model. It retains the count-per-recorded-date estimand. A more elaborate or more significant specification will not replace R0 as the headline by virtue of its result.

## Fixed specifications

Every specification uses a Poisson log conditional-mean model with ZIP, year-month and weekday fixed effects. The exposure unit for a linear coefficient is 10°F.

| ID | Exposure and adjustment | Question addressed |
|---|---|---|
| R0 | Corrected America/Los_Angeles civil-day maximum temperature; original eligibility | Effect of repairing the weather-day alignment |
| R1 | Previous civil-day maximum replaces same-day maximum | Temporal ordering sensitivity; not proof of offense-time exposure |
| R2 | R0 plus observed US federal-holiday indicator, log(1 + daily precipitation in mm), and daily mean relative humidity / 10 | A finite set of measured daily calendar/weather covariates |
| R3 | R0 plus a ZIP-specific annual sine and cosine pair | Smooth locality-specific seasonality, beyond shared year-month effects |
| R4 | R0 with any reviewed warrant co-charge excluded, in addition to existing subtype/location exclusions | Outcome-selection sensitivity |
| R5 | R2, R3 and R4 combined | Joint sensitivity to these specified changes |
| R6 | R5 with a four-knot restricted cubic spline replacing the linear temperature term | Overall association and departure from linearity |
| R7 | R5 restricted to the paired NOAA-eligible sample, retaining modeled maximum temperature | Same-sample modeled-weather comparator |
| R8 | R7 with quality-screened NOAA station maximum replacing modeled maximum on exactly the same ZIP-days | Alternate-source exposure sensitivity |
| R9 | R0 plus fixed offset log(elapsed civil-day hours / 24) | Sensitivity imposing proportional exposure opportunity for 23/25-hour days |

The R6 knots are the pooled corrected, weather-only 2021–2024 panel's 5th, 35th, 65th and 95th percentiles, fixed across outcomes and independent of arrest counts. Use an explicit linear basis plus two nonlinear basis terms. Report a three-degree-of-freedom robust Wald joint association test and a two-degree-of-freedom robust Wald test of the nonlinear terms. A nonsignificant nonlinear test does not establish linearity. Report fixed contrasts against 70°F at 50, 60, 80, 90 and 100°F only where within observed exposure support, with nominal 95% intervals and exposure-frequency context. Do not search knots, lag lengths, locations or cutoffs for favorable results.

For R7/R8, select each ZIP's nearest of the six already acquired NOAA stations by geographic distance alone; break exact ties by station identifier. Then require distance ≤25 km and absolute station-versus-ZIP modeled elevation difference ≤200 m. If the nearest station fails a screen, do not select another. Remove missing or quality-rejected station-maximum ZIP-days identically from both fits. Report station allocation, distances, elevations, included ZIPs, days and outcome counts. NOAA reporting-day conventions and local representation can differ from modeled civil-day exposure; this is an alternative measurement, not a validated improvement or individual exposure. Do not create a weather bias correction from six mean station discrepancies.

R9 is separate because proportional event opportunity across a 23/25-hour day is an assumption. The lost or repeated hour is at night, event intensity varies by hour, and the source timestamp timezone is inferred rather than agency-verified. A log-duration offset in every model would silently change the reference estimand and obscure the isolated alignment comparison.

## Inference and multiplicity

Use daily summed full-model scores, Bartlett Newey–West covariance with seven calendar-day lags, and the documented n/(n−k) finite-sample factor. Daily aggregation includes every ZIP, preserving contemporaneous cross-ZIP covariance; cross-date products preserve cross-ZIP as well as within-ZIP lagged dependence within the bandwidth. Preserve the actual calendar grid even if an entire date has no usable station exposure. Do not compress observed dates together.

Also report HAC14 and HAC28 for R0 and R5, as covariance audit sensitivities, without selecting the smallest p-value. All confidence intervals are individually 95%, not simultaneous intervals.

Apply Holm correction jointly across **22 revision-family tests**: the nine linear coefficients R0–R5 and R7–R9 for each of two outcomes (18), plus the R6 joint association and nonlinearity tests for each outcome (4). These results form one explicitly retrospective revision family. The original general five-secondary-test and DV eleven-secondary-test families remain historical; this new correction does not retroactively control every hypothesis examined across the project. Curves, fixed contrasts, and HAC14/28 estimates are descriptive/audit displays, not additional grounds for claims of statistical discovery.

Disclose every planned result, model failure, unavailable exposure and sample change. Preserve failed tests in the planned family conservatively rather than shrinking the family because a model failed. No significance-based stopping, reporting, specification replacement or subgroup search is authorized by this plan.

## Audit requirements before interpretation

1. Reconcile source-count and strict-mask totals; every eligible zero day remains represented.
2. Verify civil dates, 23/24/25-hour windows, all 1,461 primary dates, lag construction across the 2020/2021 boundary, weather units and completeness.
3. Save formula, basis/knots, station rules, variable scaling, sample totals, fitted parameter count, convergence score and sparse/dense solver status.
4. Validate accepted line search, final score, positive-definite information and absence of material separation; do not infer convergence solely from a shrunken step.
5. Independently compare coefficient and contrast covariance calculations, including spline joint tests, against a separate implementation.
6. Report observed versus model-expected zero frequency as descriptive diagnostics, not an automatic gate to selecting another outcome distribution.
7. Distinguish repaired day aggregation and tested sensitivities from unresolved missing records, uncertain identifiers/dates, incomplete geographic coverage, reporting/enforcement mechanisms, exposure error and causal confounding.

The accompanying independent review supplies the statistical rationale and primary-source references. Production implementation and public narrative remain the coordinating analyst's responsibility.

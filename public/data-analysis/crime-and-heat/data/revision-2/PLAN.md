# Response-to-feedback analysis plan

Frozen before computing revised estimates, 24 September 2026. This is a retrospective, feedback-driven amendment; original estimates were already known. It is not a preregistration or a new independent study. All proposed results will be reported. No model will be selected for statistical significance.

The original exports and released results remain preserved. Correct the weather aggregation to America/Los_Angeles civil dates, retaining the existing recorded-date outcome and eligibility rules for the amended reference model. Outcomes are all eligible source-ID groups and core-DV groups. Neither measures underlying crime incidence.

For each outcome, fit the following fixed battery for 2021–2024:

| ID | Specification |
|---|---|
| R00 | Original fixed-window weather on exactly the revised weather-available ZIP sample; reference for isolating the window correction from sample changes |
| R0 | Corrected civil-day maximum; ZIP, year-month and weekday effects |
| R1 | Previous civil-day maximum replacing contemporaneous maximum |
| R2 | R0 plus observed federal holiday, log(1 + daily precipitation in mm), daily mean relative humidity / 10 |
| R3 | R0 plus ZIP-specific annual sine and cosine terms |
| R4 | R0 after excluding any reviewed warrant co-charge in addition to the existing subtype/location screens |
| R5 | R2 + R3 + R4 combined |
| R6 | R5 with restricted cubic spline maximum temperature: four knots at the pooled weather-only primary-panel 5th, 35th, 65th and 95th percentiles, shared across outcomes |
| R7 | R5 on a paired NOAA-station-eligible sample, retaining ERA5-Land maximum temperature |
| R8 | R7 with quality-screened NOAA station maximum replacing ERA5-Land maximum on exactly the same ZIP-days |
| R9 | R0 with elapsed civil-day duration offset log(hours / 24), a sensitivity imposing proportional exposure opportunity |

Inference: Poisson mean model; daily summed score Bartlett HAC7, calendar gaps retained as empty score dates. Report HAC14 and HAC28 for R0 and R5. Report spline joint association and nonlinearity tests separately; a nonsignificant curvature test does not validate linearity. Show fixed contrasts and nominal curves without a knot or subgroup search.

Holm correction covers the 24 revision tests: ten linear coefficients per outcome (including R00), one joint spline association per outcome, and one spline nonlinearity test per outcome. Nominal confidence intervals are not simultaneous. Original testing families and results remain accessible, explicitly historical.

The station comparison and elapsed-duration checks were added following methods review, before any revised estimates were computed. Select the geographically nearest of the six previously acquired NOAA stations, breaking equal-distance ties by station ID; then require distance at most 25 km and absolute station-versus-ZIP modeled elevation difference at most 200 m. Do not substitute another station after this selection. Drop invalid/missing NOAA TMAX ZIP-days identically from R7/R8; retain calendar gaps in the HAC score sequence. NOAA reporting-day conventions and spatial representation differ; this is an alternate-source sensitivity, not validation or a corrected personal exposure. Do not infer a ZIP correction from six average station biases.

R0 continues to estimate counts per civil date. R9's duration offset is a sensitivity because the lost/repeated daylight-saving hour is nighttime and recorded-event intensity is not uniform over the day. A population offset is not introduced without a compatible denominator; fixed ZIP population offsets are algebraically absorbed by unrestricted ZIP intercepts and cannot solve changing visitors or police coverage.

Missing canonical records, unverified offense dates, personal exposure and causal identification cannot be repaired through regression changes.

## Acquisition amendment before revised estimation

The hourly provider returned an explicit daily-quota limit after 64 of 112 ZIPs had complete temperature/humidity acquisition. Requests stopped. No alternate host, fabricated value or unvalidated downscaling is used to evade or disguise the gap. Completed ZIPs contain 57,903 of the original 58,770 eligible general groups and 6,501 of 6,637 core-DV groups. This acquisition-available sample is not random.

Before any revised estimate was computed, restrict the complete R0–R9 battery to ZIPs with all required civil-day weather (subject to explicit rain-coverage validation). Add R00 for both outcomes, using original weather on the exact same sample as R0. Expand Holm22 to Holm24 accordingly. Retain all original full-sample estimates separately; do not describe R0 as a correction covering all112 ZIPs. The metadata must enumerate missing ZIPs, samples and event coverage. Further acquisition would require a separately documented completion update, not silent substitution.

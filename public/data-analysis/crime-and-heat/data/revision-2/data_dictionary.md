# Revision data dictionary

All record counts are source-scoped administrative groups, not verified people,
arrests, offenses or crime incidence. No record identifiers are distributed.

## analysis_panel.csv.gz

The zero-inclusive base panel contains 93,504 rows: 64 acquired ZIPs × 1,461 recorded
dates in 2021–2024. Model-specific all-zero ZIP exclusions, station availability and
certified seasonal zero-support reductions are reported separately. The full
descriptive panel is not reduced by those fitting operations.

| Fields | Meaning / units |
|---|---|
| zip_code,date | ZIP label and recorded local calendar date; ZIP is a string |
| eligible_all_count,original_all | Baseline eligible all-record count; identical fields |
| core_count,original_core | Baseline eligible core-DV count; identical fields |
| broad_count | Baseline eligible core-DV or broader order-related count |
| excluded_all,excluded_core | Baseline eligible groups removed by reviewed warrant co-charge screen |
| strict_all,strict_core | Baseline count minus corresponding exclusion count |
| temp_high_f,temp_mean_f,temp_low_f | Corrected local-civil-day hourly ERA5-Land maximum, arithmetic mean and minimum, °F |
| legacy_temp_high_f,legacy_temp_mean_f,legacy_temp_low_f | Released fixed-UTC−7 daily values, °F; historical comparator |
| legacy_heatwave_p90_3day | Original retrospective heatwave indicator; retained for provenance, not used by revised models |
| relative_humidity_mean_pct | Arithmetic civil-day mean ERA5-Land RH, percent |
| precipitation_mm | Civil-day sum of hour-ending ERA5 precipitation, mm; distinct/coarser product |
| day_hours | Elapsed hours in civil date: 23, 24 or 25 |
| prior_day_high_f | Previous civil-calendar-date maximum, °F; not a rolling 24-hour window |
| federal_holiday_observed | 0/1 observed US federal-holiday indicator; 44 dates |
| station | Nearest of six previously acquired NOAA station identifiers; not an arrest ID |
| distance_km | Great-circle ZIP representative-point to station distance, km |
| absolute_elevation_difference_m | Absolute station minus modeled ZIP elevation difference, m |
| station_eligible | Distance ≤ 25 km and elevation difference ≤ 200 m after nearest-station selection |
| noaa_high_f | Quality-screened NOAA daily maximum, °F; missing where unavailable; source day convention retained |
| station_paired | Station geographically eligible and maximum available; exact common R7/R8 support |

## Results and diagnostics

revision_models.csv contains 22 rows; count_ratio = exp(coefficient_log_count) for a 10°F
linear temperature increment. ci95_low/high are individual 95% limits. R6 has three
spline temperature coefficients and joint/curvature Wald tests instead of one ratio.
revision_tests.csv contains 24 hypotheses and the single revision-family Holm result.
hac_sensitivities.csv uses 7, 14 and 28 calendar-day Bartlett bandwidths for R0/R5.
nonlinear_curves.csv shows fixed-reference 70°F contrasts with pointwise 95% intervals.
No filtered browser view refits these static models.

specifications: R00 paired legacy weather; R0 corrected reference; R1 previous day;
R2 holiday/rain/RH; R3 ZIP annual harmonics; R4 warrant exclusion; R5 combined;
R6 combined spline; R7 paired NOAA-eligible sample with modeled temperature;
R8 identical sample with NOAA temperature; R9 elapsed-day-duration offset.

Fitted npz files contain coefficients, coefficient labels, aggregate daily scores/
influence, fitted/observed daily totals and selected covariance; no individual rows.
Daily zero-frequency diagnostics compare observed zero frequency with average
exp(-predicted mean) on each model's fitted support. They do not establish a
structural-zero process or verify the conditional-mean specification.

## Weather and source aggregates

daily_zip_weather_civil.csv contains 175,424 rows: 64 ZIPs × 2,741 dates, 2018-07-01–2025-12-31.
Extra columns include RH extrema, per-variable hourly counts, UTC day boundaries,
start UTC offset, prior-day mean/minimum, parallel fixed-UTC−7 hourly aggregates,
and public precipitation grid coordinates. These timestamps describe weather windows,
not individuals. civil_day_windows.csv has one row per date. Of 1,461 primary dates,
509 start boundaries differ from 07:00 UTC; 513 complete windows differ in at least one
boundary. Of 2,741 dates overall, 948 starts and 956 complete windows differ.

warrant_primary_zip_daily_sparse.csv contains only ZIP-date counts. Its missing
rows must be zero-filled after joining onto the defined calendar, not deleted.
warrant_charge_audit.csv contains category/code descriptions and aggregate counts.
Source header labels and hashes document supplied files without exposing records.

The weather quota restricts geography; 2025 remains incomplete in the source record
export and is excluded from all revision regressions. Daily zeros do not certify
that the agency had zero actual arrests. See plan, coverage and provenance notes.

## Revised browser files and full-span count download

`daily.json` and `category_daily.json` retain schema version `1.0.0`, with revision
metadata `2.0`. Each has the same ordered `zips` and `dates` axes: 64 ZIPs and 2,741
dates from 2018-07-01 through 2025-12-31. Each of its seven `data` arrays contains
175,424 values in ZIP-major order. For zero-based indices, read
`data[columnIndex][zipIndex * dates.length + dateIndex]`; `columns` supplies the
meaning of each array. Do not concatenate categories as though they were disjoint.

`daily.json` columns are `core`, `broad`, `all`, `high10`, `mean10`, `low10` and
`heatwave`. Counts use the original weather-eligible population in the acquired
ZIPs, including zero ZIP-days; they do not apply the stricter warrant sensitivity.
Temperatures are integers in tenths of a degree Fahrenheit: divide by 10. Browser
rounding does not change the model input, which retains the unrounded hourly mean.
`timezone` is `America/Los_Angeles`; `day_hours_by_date` contains 2,741 corresponding
23-, 24- or 25-hour durations. Date-level source-presence and incomplete-year flags
are coverage annotations, not proof that an absent record means no arrest occurred.

`category_daily.json` contains the seven labeled nonexclusive count arrays, aligned
to exactly the same axes. Its categories preserve the original eligibility and
definitions; no category-specific revised regression is implied. Regional browser
temperature summaries average the selected ZIP values without population weights;
unadjusted count rates use the selected zero-inclusive ZIP-day denominator.

`daily_zip_civil_counts.csv.gz` is the corresponding 175,424-row, full-span download.
It includes `core_count`, `broad_count`, `all_count` and `heatwave_p90_3day` alongside
the corrected temperatures, RH, precipitation, day duration and other weather
columns described above. UTC timestamps in that file are weather-window boundaries,
not individual event timestamps. It differs from the 2021–2024 regression panel.

The revised `heatwave` flag recomputes the original retrospective definition using
corrected civil-day maxima: each ZIP's 90th percentile of available May–September
2018–2024 maxima, then all days in a run of at least three consecutive May–September
dates at or above that threshold. Thresholds are supplied in `heatwave_thresholds.csv`.
This is a descriptive recomputation, not an official heat alert or a new fitted
heatwave model in the revision battery. The baseline is not an independent climate
normal, and 2025 record incompleteness still limits its descriptive comparisons.

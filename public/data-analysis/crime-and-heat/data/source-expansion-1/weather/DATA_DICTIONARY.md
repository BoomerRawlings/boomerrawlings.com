# Data dictionary

Blank CSV cells mean missing, rejected, inapplicable, or unresolved, as specified below. They never mean zero. Temperatures use °F; distances use kilometres; elevations use metres. `date` is ISO `YYYY-MM-DD`.

| File / fields | Definition |
|---|---|
| GHCN `station`, `date` | NOAA station identifier and unshifted source summary date. |
| `temp_high_f`, `temp_low_f` | Valid source TMAX/TMIN, tenths °C converted to °F; not forced to civil-midnight periods. |
| `reported_tavg_f`, `reported_taxn_f` | Distinct source TAVG and TAXN. TAVG is absent in this primary-period extract; never replaced by a midpoint. |
| `tmax_tmin_midpoint_f` | Explicitly calculated `(TMAX + TMIN)/2`, only if both are present. Not an observed hourly mean. |
| `*_measurement_flag`, `*_quality_flag`, `*_source_flag` | Original GHCN flags; any nonblank quality flag excludes that variable. Precipitation measurement flag `T` denotes a trace. |
| `precipitation_mm` | Valid GHCN PRCP in mm. Trace can have numeric zero and retained `T`; source observing period applies. |
| `temperature_order_valid` | Check that valid minimum does not exceed valid maximum. All retained rows pass. |
| ISD `station`, `icao` | USAF-WBAN pair and airport identifier. |
| `utc_hour` | Start of the UTC clock hour containing the selected original observation; not a rounded observation timestamp. |
| `observation_utc`, `observation_local` | Actual source timestamp, expressed in UTC and IANA local time with explicit numeric offset. |
| `temp_f`, `temperature_quality`, `report_type`, `source_flag` | Original accepted instantaneous temperature and ISD flags. Allowed temperature quality: 1, 5, C; C indicates accepted whole-degree AWOS data. |
| `valid_reports_in_hour` | Number of accepted candidate source reports before selecting the observation closest to minute 30. |
| ISD daily `day_hours` | Actual civil-day length: 23, 24, or 25 hours. |
| `valid_hourly_samples` | Number of distinct UTC clock hours with an accepted selected observation in the local date. |
| `complete_civil_day` | Exactly every expected hour represented. |
| `whole_degree_awos_C_samples` | Selected hourly observations carrying flag C. |
| Daily `temp_high_f`, `temp_mean_f`, `temp_low_f` | Maximum, equal-hour arithmetic mean and minimum of hourly samples, populated only for complete days. Not continuously measured extrema. |
| `available_sample_*` | Same summaries using available selected samples, even on incomplete days. These are not used as complete exposures. |
| `all_valid_reports_high_f`, `all_valid_reports_low_f` | Extrema across all accepted instantaneous reports that day; reporting-frequency dependent. |
| `utc_start`, `utc_end` | Exact half-open civil-day boundaries `[start,end)` in UTC. |
| Station `*_days` / `expected_hours` | Observed usable counts versus stated calendar denominator; inventory first/last years are not completeness claims. |
| Assignment `eligible_station_match` | Nearest candidate station meets both ≤25 km distance and ≤200 m elevation difference. Candidate screening is defined in README. |
| Pair `legacy_*`, `civil_*` | Original fixed UTC−7 and revised civil-day ERA5-Land temperatures, respectively. Retained as separately named sources. |
| Pair `eligible_all_count`, `core_count`, `broad_count` | Existing daily ZIP aggregate record-group counts; no individuals or incident-site validation. |
| Metrics `matched_zip_days` | Usable ZIP/date pairs for that variable; shared stations create repeated measurements across ZIPs. |
| Metrics bias / MAE / RMSE / correlation | Modeled ZIP point minus observed station, unless column explicitly says GHCN minus ISD. Descriptive comparisons, not causal effects or independent sample sizes. |
| Baseline `tmax_p90_f`, `tmax_p95_f` | 1991–2020 pooled May–September empirical percentiles, available only when both completeness criteria pass. |
| `exceeds_p90`, `exceeds_p95` | Strictly above eligible station threshold on a warm-season date; missing outside season or without a valid observation. |
| `three_consecutive_days_*` | Membership in a confirmed ≥3-day warm-season exceedance run. Includes initial days retrospectively. Missing if unavailable observations make membership unresolved. |

Source formats: [GHCN-Daily README](https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt), [ISD field documentation](https://www.ncei.noaa.gov/pub/data/noaa/isd-format-document.pdf). Geographic points for existing ZIPs retain the original Census-point provenance in the released weather documentation.

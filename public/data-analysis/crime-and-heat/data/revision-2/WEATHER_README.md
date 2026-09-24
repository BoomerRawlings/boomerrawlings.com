# Civil-day weather revision — verified partial acquisition

This is a **64-ZIP sensitivity dataset**, not a complete replacement for the released 112-ZIP weather panel. It covers every calendar day from **2018-07-01 through 2025-12-31**: 175,424 ZIP-days. No temperature, relative-humidity, precipitation, day-duration or prior-day values are missing within this subset. The original files in `weather/` were not modified.

Download order prioritized ZIPs with the largest source-row counts. The subset is therefore **not random**. It contains 57,903 of 58,770 primary-period eligible general record groups (98.525%) and 6,501 of 6,637 core-DV groups (97.951%). These are record coverage fractions, not population coverage. A valid comparison fits the released and revised exposures on the **same 64 ZIPs**, retaining the full original analysis separately.

## Acquisition boundary

The provider returned HTTP 429, explicitly identifying its daily quota. Acquisition stopped with 64/112 temperature/RH points and 18/19 rainfall grids cached. The exact quota-reset timestamp is unknown. No new download run was started after the failure was observed. Concurrent requests already in flight finished or returned errors. Later verification and preparation are offline. Long requests count toward weighted usage; the provider documents a daily free-service limit. [Open-Meteo pricing and request accounting](https://open-meteo.com/en/pricing).

`acquisition_audit.json` and `acquisition_coverage_by_zip.csv` identify every missing ZIP. The completed points cover 37 of the original 50 ERA5-Land grids. Thirteen temperature grids remain wholly unavailable. No missing point shares both an acquired grid and the same target elevation; consequently no temperature or RH was copied across points or synthesized using a lapse rate. Provider input rounding and derived RH would require separate validation before any such reconstruction.

## Sources and aggregation

Temperature and RH use **hourly ERA5-Land** through Open-Meteo, preserving each original Census representative coordinate, land-cell selection and original returned elevation. The elevation is now explicit in the request. Every returned ERA5-Land grid and elevation matches the released mapping. Temperature is Fahrenheit; RH is percent. These remain modeled representative-point exposures, not observed incident-site conditions. [API parameters and hourly variables](https://open-meteo.com/en/docs/historical-weather-api); [ERA5-Land dataset](https://doi.org/10.24381/cds.e2161bac).

All hourly requests explicitly use **GMT Unix timestamps**. Local dates are computed afterward using IANA `America/Los_Angeles` rules through Python `zoneinfo`; the installed timezone-data version is recorded. Temperature and RH use instants in **[local midnight, next local midnight)**. Temperature maximum/minimum and arithmetic means use all 23, 24 or 25 hourly observations. The repeated fall hour is retained twice as distinct UTC instants. [Python IANA timezone support](https://docs.python.org/3/library/zoneinfo.html).

The full span contains 7 spring 23-hour days, 8 fall 25-hour days and 2,726 ordinary 24-hour days. The 2021–2024 period contains 4 spring days, 4 fall days and 1,453 ordinary days. `day_hours` exposes the actual duration for modeling sensitivity. Exact start/end UTC boundaries are in `civil_day_windows.csv`. The windows differ from the released fixed UTC−7 window on 956 full-span dates and 513 primary-period dates.

Precipitation is **explicitly sourced from ERA5**, a coarser 0.25° product; it is not labeled ERA5-Land. The ERA5-Land API pilot returned all-null precipitation, consistent with the provider's availability table. The separate ERA5 mapping yields 19 grids across 112 ZIPs; 15 grids supply the completed 64-ZIP panel. Precipitation is summed in millimeters over hour-ending timestamps **(local midnight, next local midnight]**, because each value represents the preceding hour. [Variable availability and precipitation interval](https://open-meteo.com/en/docs/historical-weather-api); [ERA5 dataset](https://doi.org/10.24381/cds.adbb2d47).

One rainfall series is reused only within the same returned ERA5 grid. The provider's pinned variable implementation does not apply elevation correction to precipitation. A wet 72-hour test at all 112 requested points independently confirmed equal precipitation within each shared grid. Temperature/RH receive no analogous reuse. [Pinned ERA5 variable implementation](https://github.com/open-meteo/open-meteo/blob/6d7e23e81efdc4687c06ec4137822d43f9fdda6f/Sources/App/Era5/Era5Variables.swift).

Requests include padding from 2018-06-29 through 2026-01-02. `prior_day_high_f`, mean and low use the preceding **civil calendar day**, including before the first analytical day. They are not fixed 24-hour rolling windows. A record-time preceding-24-hour analysis is feasible from the saved hourly cache without further downloads, but timezone-naive recorded times would need an explicit ambiguity policy for repeated or nonexistent local times. Prior-day exposure precedes the recorded date; it does not establish that it precedes the actual offense.

## Quantified differences

For the 64-ZIP primary-period panel (93,504 ZIP-days):

| Variable | Changed versus released | Mean absolute difference | Maximum absolute difference |
|---|---:|---:|---:|
| Daily maximum | 104 | 0.000499°F | 1.5°F |
| Daily mean | 90,627 | 0.056604°F | 0.570833°F |
| Daily minimum | 3,601 | 0.031839°F | 4.6°F |

The mean's large changed-cell count includes rounding differences. Reaggregating the fresh hourly series over the original fixed UTC−7 interval reproduces every released primary-period maximum and minimum exactly. Its daily mean differs by mean absolute 0.025294°F, maximum 0.075°F, reflecting hourly-versus-daily aggregation precision. Comparing the corrected civil mean to this fresh fixed-window mean isolates the time-window change: mean absolute 0.039279°F, maximum 0.545833°F. These components are reported separately in `temperature_difference_summary.csv`; they must not be presented as all caused by DST correction. Arithmetic precision is not exposure accuracy.

## Verification and reproduction

`verification.json` reports **PASS** for an independent full recomputation: UTC timestamps were converted and grouped by local dates, rather than using the production boundary slices. It verified 2,105,088 numeric cells; maximum difference is below 4.8×10⁻⁹ from decimal rounding. All 175,424 date/ZIP keys are unique, with no missing output values. Four targeted tests check spring boundaries, both repeated fall hours, ordinary winter/summer midnights, and precipitation hour-ending alignment. This is a separate computational path, not independent human review.

The final CSV SHA-256 is `4dd4df04aeb05780770919567d8241f1b64403b4410f432c0fb68ab6f885d225`. The released weather SHA-256 remains `08fa76f75714b919380f96e6ce223cabfdda8ca395df03deac57c120c6969006`.

Normal full reproduction, **only after permitted provider access resumes**:

```text
python acquire_civil_weather.py
python acquire_precipitation.py
python finalize_weather.py
python test_civil_aggregation.py
python verify_revision.py
python audit_acquisition.py
```

Cached downloads are reused. `finalize_weather.py` refuses an incomplete panel by default; `--allow-partial` is deliberate authorization to label a restricted sensitivity subset. The existing partial CSV is already verified and should not trigger new requests. Reproducibility metadata contain public coordinates, request URLs and hashes, without record identifiers or arrest/person data.

Suggested public files: this README; `daily_zip_weather_civil.csv`; `weather_revision_provenance.json`; `verification.json`; `acquisition_audit.json`; `acquisition_coverage_by_zip.csv`; `temperature_difference_summary.csv`; `temperature_differences_by_zip.csv`; `civil_day_windows.csv`; `temperature_locations.json`; `precipitation_locations.json`; `precipitation_mapping.json`; `precipitation_grid_pilot_checks.json`; `provider_source_provenance.json`; the five Python scripts and boundary tests. Raw hourly caches and their request manifests can remain in the separate reproducibility archive to avoid a large interactive-page transfer.

## Bounded alternative-access assessment

ECMWF's official ERA5-Land ARCO service offers hourly temperature/dewpoint and precipitation grids suitable for time-series access, but its documented access requires a **CDS API key**. This is not documented anonymous access. [ECMWF ARCO guide, access section](https://confluence.ecmwf.int/spaces/CKB/pages/536218894/ERA5-Land+hourly+Analysis+Ready+Cloud+Optimised+ARCO+data+on+single+levels+from+1950+to+present+Product+User+Guide+PUG).

Google Earth Engine publishes ERA5-Land hourly data but requires registered Earth Engine access. The AWS registry result located in this bounded check was ERA5, not ERA5-Land; it would be a distinct exposure source and would not automatically reproduce the existing point downscaling. No alternative data service, credential or provider host was used to evade the quota. [Earth Engine ERA5-Land catalog](https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_HOURLY); [AWS ERA5 listing](https://registry.opendata.aws/earthmover-era5/).

An independently defined, longer heatwave baseline, incident-location exposure and confirmed offense timestamps remain unresolved by this weather acquisition. No station-based bias correction was applied.

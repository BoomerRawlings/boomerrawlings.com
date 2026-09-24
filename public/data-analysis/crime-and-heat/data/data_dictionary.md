# Aggregate public data dictionary

Only aggregate source-ID counts and public weather geography are included. No record IDs, charge-line records, street blocks, personal addresses or exact event timestamps are published. Source locality fields sometimes contain addresses; public city tables retain reviewed place labels and collapse all others into `OTHER/UNVERIFIED LOCALITY LABEL`, preserving totals. `SHERIFF (administrative label)` and `MULTIPLE/CONFLICTING` remain explicit. No assertion that original locality labels are accurate municipalities.

## Files and populations

- `summary.json`: first fetch; twelve regression estimates, individual 95% intervals, Holm p-values, coverage, definitions, sources, weather metadata and dataset references.
- `aggregates.json`: `{schema_version,tables}`; each table has `{population,note,columns,rows}`. Convert each row array with its `columns` array. `by_*` and timing tables concern **all supplied source-ID groups**; eligible ZIP tables concern **weather-eligible groups**. These populations differ.
- `daily.json`: lazy-fetch. Dates and ZIP strings are dictionaries. `data` is seven column arrays in `columns` order: `[core,broad,all,high10,mean10,low10,heatwave]`. Row index = `zipIndex * dates.length + dateIndex`. Each ZIP has every date. Divide temperature integers by 10 for °F. `all` means **all weather-eligible groups**, never all supplied records. `broad` includes `core`.
- Date-length arrays: `raw_source_present_by_date` indicates any raw charge row on that calendar date, `incomplete_export_by_date` flags 2025, `primary_period_by_date` flags 2021–2024. `weekday_by_date` is Monday=0 through Sunday=6; use it instead of browser-local conversion of ISO dates. These arrays do not vary by ZIP; raw record absence is not proof of zero arrests.
- `downloads/`: public aggregate CSVs. `daily_zip_eligible_weather.csv` is the same daily ZIP aggregate data in long form; individual rows are ZIP-day totals, not arrest records. `aggregate_downloads.zip` contains only these aggregate CSVs plus this dictionary. No full private analysis archive is public.

## Exact denominators and filters

Default dates 2021-01-01–2024-12-31, all 112 weather ZIPs. Sum `core`, `broad`, or `all`; divide by the count of selected ZIP-day rows, including zero-outcome days. Multiply by 100 for records per 100 ZIP-days. Under a temperature band, count every selected ZIP-day matching the temperature, not just days with records. Weekday rates use the number of selected ZIP-days on each weekday; all-source regional daily rates instead use calendar days. Do not mix these denominators. ZIP-day rates are not population rates or county-day rates. Pooled filtered results remain unadjusted for place/season/calendar confounding.

Primary-period panel has 163,632 ZIP-days (112 × 1,461), 6,637 eligible core IDs. The fitted model omits 17 all-zero ZIPs (95 × 1,461 = 138,795 rows), while raw rates retain them. Published model estimates stay static when filters change. Never display a regression result as if refitted to a selected locality or year.

Coverage: July 2018–December 2025; 2018 partial; 2025 incomplete; no 2026. 79 dates lack raw rows; 83 lack an unambiguous-date ID after conflict exclusion. 37 IDs spanning years stay in unassigned/conflicting year. SHERIFF localities change coding in 2024. Year/city/month sums include their conflict category; per-date counts cannot include date-conflicting groups. Charge-category ID counts overlap; never sum them as unique arrests.

Weather: ERA5-Land reanalysis, approximately 9 km, ZIP/ZCTA representative points, 112 ZIPs sharing 50 grid cells. Daily high/hourly-based mean/low in °F. Fixed UTC−7 windows start 23:00 previous local date in standard time. `heatwave` flags all dates in May–September runs of 3+ days with maximum at/above each ZIP's available 2018–2024 May–September 90th percentile; not an official alert. The comparison with six NOAA stations is separately supplied; modeled absolute thresholds are not verified thermometer readings.

Primary regression: core counts 2021–2024, maximum temperature per 10°F, Poisson log link with ZIP/year-month/weekday fixed effects. Daily summed-score Newey–West HAC7 uncertainty. No population/total-arrest offset. All secondary model p-values carry a Holm adjustment across 11 tests; intervals are individual 95%, not simultaneous. No causal inference or true DV-incidence inference.

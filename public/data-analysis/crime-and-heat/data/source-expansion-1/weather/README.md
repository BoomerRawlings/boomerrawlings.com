# NOAA observational weather supplement

This supplement expands the observational weather evidence. It does not replace either released ERA5-Land panel, fill the 48 unavailable hourly-reanalysis ZIPs, or fit new arrest-record models. All record counts below are coverage descriptions using the existing public aggregate panel.

## Acquired data

- **GHCN-Daily:** 29 regional station archives; 296,825 station-date rows from 1991–2025. The export-era extract contains 74,894 rows, July 2018–December 2025. Station selection used the NOAA inventory: US stations within 32.5–33.55° N, 117.6–116.05° W, with a listed TMAX record beginning by 2021 and ending in or after 2024. This geographic box is a regional search, not a county-boundary membership test. Inventory spans do not guarantee continuous observations.
- **Full ISD:** 12 airport stations; 379,574 selected hourly observations and 17,532 station-date rows for 2021–2024. Of these, 13,235 station-days contain every expected civil-day hour. Raw years 2021–2025 include UTC padding for the last local day of 2024. Curated data exclude 2025.
- **Long baseline:** six stations meet the stated completeness criteria for 1991–2020 May–September temperature percentiles. This baseline precedes the 2021–2024 primary analysis, but overlaps the descriptive export’s 2018–2020 years.

These are separate NOAA station products: GHCN contains daily summaries; ISD contains individual observations and quality flags. See the [GHCN product description](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily) and [ISD product description](https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database).

## Quality, units and daily means

GHCN values with nonblank quality flags are excluded; missing values remain missing. Temperature is decoded from tenths of Celsius and converted to Fahrenheit; precipitation is millimetres. Measurement and source flags remain in the extract. Dates are retained as supplied: station observing periods need not coincide with civil midnight. Reported TAVG is distinct from TAXN, which is the maximum/minimum midpoint; TAVG methods vary by source. **No usable reported TAVG exists in the 29-station primary-period extract.** The separately named calculated midpoint is not an observed daily mean. These interpretations follow the [GHCN format and flags](https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt).

ISD accepts temperature flags 1 and 5 (passed all checks), plus C (whole-degree AWOS values accepted as valid). Other flags, including suspect, erroneous, and only gross-limit-checked values, are excluded. Accepted original timestamps are UTC; conversions use `America/Los_Angeles`. Summary-of-day/month reports are excluded by an explicit instantaneous-report whitelist. Field positions and flag meanings come from the [ISD format documentation, pp. 5–11](https://www.ncei.noaa.gov/pub/data/noaa/isd-format-document.pdf).

Our hourly sampling rule selects one accepted observation per UTC clock hour, closest to minute 30. Ties use original timestamp, preference for routine FM-15 reports, quality/source codes, then source order; temperature never determines selection. The CSV retains the original observation time. Daily mean, high and low summarize these hourly samples, with equal weight per represented hour. Main fields are populated only when all 23, 24 or 25 hours are present. Other columns expose incomplete-day sample summaries and extremes across all accepted reports. These are **sampled extrema**, not continuous instrumental daily extremes. An exact civil-day assignment does not make sampling continuous.

ISD-Lite was deliberately not used: it rounds timestamps and omits quality flags. NOAA cautions against it when exact timing or observation density matters. See the [ISD-Lite technical document](https://www.ncei.noaa.gov/pub/data/noaa/isd-lite/isd-lite-technical-document.pdf).

## Geography and paired coverage

Candidates require at least 90% usable 2021–2024 daily maxima (GHCN) or complete civil days (ISD). Each of the original 112 ZIP representative points is assigned the horizontally nearest candidate; retain it only within 25 km and 200 m elevation difference. No fallback to a second station when the nearest fails elevation. The same rule is applied to the current archives for the original six stations, making network expansion comparable without mixing data snapshots.

| Network | Eligible stations | Matched ZIPs | Paired Tmax ZIP-days | All eligible groups | Core DV groups |
|---|---:|---:|---:|---:|---:|
| Original six, refreshed archive | 6 | 80 | 116,418 | 38,502 | 3,906 |
| Expanded GHCN | 25 | 94 | 136,243 | 53,981 | 5,945 |
| Complete civil-day ISD | 5 | 80 | 112,131 | 38,461 | 3,805 |

Among the 64 revised weather ZIPs, expanded GHCN yields 54 matched ZIPs and 78,580 paired maximum-temperature ZIP-days; ISD yields 43 and 60,472. Daily archive availability and ISD completeness are different criteria. In particular, a station may have reliable daily maxima but lack sufficiently complete accepted hourly samples.

`weather_paired_metrics.csv` compares modeled ZIP-point temperatures with observations at assigned stations. Differences include spatial separation, elevation, observing periods, and sampling as well as model error. Pooled metrics repeat a station across multiple ZIPs; they are descriptive and are not independent validation sample sizes. `ghcn_vs_isd_same_station.csv` offers WBAN-linked station comparisons. No bias correction is applied.

The original six cached API series contain whole-degree Fahrenheit values; newly decoded archive values retain tenths-of-Celsius precision. Every matched primary-period maximum/minimum agrees after rounding the archive value to whole Fahrenheit; the largest unrounded difference is 0.26°F. See `original_six_cache_reconciliation.csv`.

Observational comparison is not proof of independence from the reanalysis: observations can indirectly influence ERA5-Land through ERA5 atmospheric forcing. The [Copernicus ERA5-Land description](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land?tab=overview) explains that relationship. Station measurements also do not establish incident-site or personal heat exposure.

## Exploratory baseline thresholds

For each station, pool valid May–September daily maxima from **1991–2020**. Require at least 90% of the 4,590 possible warm-season days and at least 25 years individually meeting 90% coverage. Compute linearly interpolated empirical 90th and 95th percentiles (NumPy/type 7 convention). Eligible stations are Borrego Desert Park, Campo, Cuyamaca, Henshaw Dam, Palomar Mountain Observatory, and San Diego International Airport.

These are warm-season pooled thresholds—not annual percentiles, day-of-year climatologies, official heat-warning criteria, or official NOAA climate normals. The use of 1991–2020 aligns the reference period with a [NOAA normals period](https://www.ncei.noaa.gov/access/us-climate-normals/); it does not confer the quality controls or homogenization of the official normals product. No adjustment for station moves or instrument changes has been made.

Exceedance flags use **strictly greater than** the threshold. Three-day flags mark membership in a run of at least three consecutive May–September dates above the threshold, including the first two days once the run is established. Missing observations never count as cool days: indeterminate run membership remains missing. These descriptive flags are retrospective, exploratory, and not entered into any new outcome model. A subsequent model comparison would require a declared analysis and multiplicity plan.

## Files and reproduction

- `ghcn_daily_1991_2025.csv.gz`, `ghcn_daily_2018_2025.csv`: daily observations and retained flags.
- `isd_selected_hourly_2021_2024.csv.gz`, `isd_civil_daily_2021_2024.csv`: original selected timestamps and explicit daily completeness.
- `*_station_coverage.csv`, `*_selected_stations.json`: sites, coordinates and coverage.
- `*_zip_station_assignment.csv`, `*_zip_pairs_2021_2024.csv.gz`, `*_paired_metrics.csv`, `network_coverage_comparison.csv`: geographic assignments and comparison results.
- `ghcn_baseline_thresholds_1991_2020.csv`, `ghcn_heat_exceedance_2021_2024.csv`: exploratory reference thresholds and dated flags.
- `comparison_summary.json`, `verification.json`, `raw_manifest.json`, `artifact_manifest.json`, `DATA_DICTIONARY.md`: checks, URLs, SHA-256 hashes and definitions.
- `reproduction_inputs/`: four limited public aggregate inputs with their own manifest and parent-source hashes. No record IDs or individual arrest data.

With Python 3.11+ and `numpy`, `pandas`, and `tzdata` installed, run from this directory:

```text
python compare_noaa.py
python verify_noaa.py
```

These work offline from the supplied curated data and reproduction inputs. The full raw-replay check used during preparation is `python verify_noaa.py --raw`; it requires the raw archives, which are not bundled in the compact public supplement. `expand_noaa.py inventory`, `ghcn`, and `isd` regenerate data from direct NOAA downloads. `raw_manifest.json` records every exact source URL and hash. Regeneration rejects changed cached or remotely fetched source bytes rather than quietly substituting a later NOAA revision. Live NOAA archives can change; an unavailable historical hash is a reproducibility limit, not permission to replace it. A new snapshot requires a separately versioned acquisition.

The one-time `compare_noaa.py --prepare-inputs PATH_TO_ANALYSIS_ROOT` command exports the four source aggregates from the original analysis workspace. It is unnecessary for the public bundle and must not be used to overwrite its frozen inputs.

Citation: Menne et al. (2012), *Global Historical Climatology Network–Daily, Version 3*, [doi:10.7289/V5D21VHZ](https://doi.org/10.7289/V5D21VHZ); NOAA NCEI, Integrated Surface Database, station/year subsets listed in `raw_manifest.json`. Retrieval timestamps accompany each source.

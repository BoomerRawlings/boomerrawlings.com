# Aggregate data dictionary

- `sandag_group_a_daily_agency_dv.csv`: calendar date × reporting agency × officer DV flag. `source_rows` counts source rows; `distinct_incidents` counts incident IDs within that agency and cell; `distinct_offense_ids` is an identifier count, not asserted to be the official NIBRS count. `True`/`False` are source flags. All flags populated.
- `sandag_group_b_daily_agency_dv.csv`: arrest date × agency. Same count fields, plus `distinct_arrest_numbers`. DV field blank for every row because source is null; do not classify blank as non-DV. Group B only, not all arrests.
- `*_monthly_agency_dv.csv`: same measures directly queried within calendar month. Do not assume every distinct measure sums across dates or offenses; Group B incident IDs recur across arrest dates.
- `*_monthly_agency_offense.csv`: month × agency × NIBRS offense code. Incidents/arrests can overlap across offense codes; distinct counts are not additive across codes. Join descriptions from `sandag_offense_dictionary.csv`.
- `*_agency_coverage.csv`: full-period agency counts and earliest/latest recorded dates. Date endpoints do not establish completeness.
- `*_agency_dv_flag.csv`: full-period flag partition. No Group A incident spans both flag values within agency in this snapshot.
- `*_status_counts.csv`: source portal-processing status frequencies, including blank; no status exclusions applied.
- `sdpd_nibrs_YYYY_daily.csv`: occurrence date × Group A/B × crime-against code. `PE` persons, `PR` property, `SO` society; empty values remain unassigned. `source_rows` and `distinct_nibrs_offense_ids` coincide within each acquired file. Distinct case counts can overlap across categories.
- `sdpd_nibrs_YYYY_monthly_offense.csv`: occurrence month × A/B group × offense code/description; counts are source rows. SDPD and SANDAG San Diego overlap: never add them.
- `sandag_annual_domestic_violence.csv`: `year`, `domestic_violence`; 37 reported annual values, 1986–2022. Not a daily or arrest series; no invented 1980–1985 zeros.
- `sheriff_monthly_arrest_benchmarks.csv`: six explicitly sourced month observations, total arrests, available force partition, report date/page, URL and exclusions. Blank force cells were not provided for the historical comparison column, not zero.

The daily and monthly files are **sparse observed aggregate cells**, not verified zero-inclusive reporting panels. An omitted row means no returned cell, not established zero crime or complete participation. Before weather modeling, define an agency coverage window and zero-day policy independently. Current dates are subject to reporting lag. Timestamp timezone is not established by the source dictionaries; no timezone conversion was made. No populations or rates are supplied, and the counts do not measure residents' risk.

`*_metadata.json` files retain official descriptions, schema and update claims, excluding cached example values. `retrieval_metadata.json` hashes the actual HTTP responses. `reconciliation.json`, `snapshot_audit.json` and `manifest.json` document numerical, privacy and integrity checks. Source-reporting accuracy and completeness remain agency-dependent.

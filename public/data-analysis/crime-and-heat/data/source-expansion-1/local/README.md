# Official local data supplement

Retrieved September 24, 2026. Research and acquisition only; no new heat-effect models and no changes to the original arrest analysis.

The strongest new outcome is **officer-flagged domestic-violence incidents in SANDAG's public CIBRS Group A data**. It measures recorded incidents, not DV arrests or unreported violence. SDPD NIBRS provides a separate city offense series. Neither source certifies the completeness or meaning of the supplied Sheriff arrest exports.

## Acquired snapshots

| Source | Acquired coverage | Unit and appropriate use |
|---|---|---|
| SANDAG public Group A | January 1, 2021–September 23, 2026; 791,760 rows, 624,649 distinct agency-scoped incidents; 66,681 DV-flagged incidents | Daily agency incident series, with separate DV flag; 11 agencies represented, not every county law-enforcement agency |
| SANDAG public Group B | January 1, 2021–September 23, 2026; 112,170 rows, 111,957 distinct agency-scoped arrest numbers | Selected Group B arrest categories only; DV column entirely null |
| SDPD NIBRS | January 1, 2020–September 23, 2026; 549,408 countable-offense rows across seven yearly files | Separate SDPD offense outcome; each file has unique NIBRS offense IDs and valid occurrence dates |
| SANDAG historical county DV | 37 annual values, 1986–2022 | Long-run annual context, not a daily heat outcome; chart title says 1980–2022 but the actual values begin in 1986 |
| Sheriff monthly reports | Six observations from three accessible official reports | Patrol-arrest benchmark; not a complete monthly series and not a reconciliation with the supplied exports |

Sources: [SANDAG Group A](https://opendata.sandag.org/ARJIS/CIBRS-Group-A-Public-Crime-Data/pr74-d3tr), [Group B](https://opendata.sandag.org/ARJIS/CIBRS-Group-B-Public-Crime-Data/huzf-mi2z), [SDPD NIBRS](https://data.sandiego.gov/datasets/police-nibrs/), [historical DV chart](https://opendata.sandag.org/Criminal-Justice-Public-Safety/Total-Domestic-Violence-Crimes-in-the-County-of-Sa/2cpk-3bww), [underlying annual table](https://opendata.sandag.org/resource/qbrv-e75t.json), [Sheriff monthly reports](https://www.sdsheriff.gov/resources/open-data/law-enforcement-monthly-activity).

## Definitions and comparability

**Group A:** `domestic_violence_incident` is a Boolean indicating whether an officer flagged any DV occurrence on the crime case. True identifies flagged cases; false means not flagged, not independently confirmed absence of DV. All Group A flag values are populated. An incident can contain several offenses and victims. The source's offense ID includes a victim component; motor-vehicle-theft counting also depends on stolen vehicles. Therefore neither row counts nor simple distinct offense-ID counts are asserted to reproduce official NIBRS offense totals. The recommended incident outcome is `distinct_incidents` within agency. DV cases need not involve only DV offenses or an arrest. [Official field metadata](https://opendata.sandag.org/api/views/pr74-d3tr.json)

The Sheriff Group A subset contains 133,003 incidents, including 15,513 DV-flagged incidents. In 2025 it contains 14,819 incidents and 1,605 DV-flagged incidents, distributed across all 12 months. These are observed snapshot counts, not completeness estimates. All incident counts reconcile across the daily and flag partitions without cross-date or mixed-flag overlap within agency. [Reproducible official aggregate endpoint](https://opendata.sandag.org/resource/pr74-d3tr.json?$select=agency,count(distinct%20incidentuid)%20as%20incidents&$group=agency)

**Group B:** the dictionary distinguishes arrest dates and agency-scoped arrest numbers. Incident IDs can cover multiple arrests. Its DV column is text and every value is null; null must never become false or zero DV. Daily incident sums exceed full-period distinct incidents by 44 because some incident IDs appear on multiple arrest dates. Arrest-number counts are retained separately. Group B does not contain all arrests associated with Group A crimes. [Official field metadata](https://opendata.sandag.org/api/views/huzf-mi2z.json)

**SDPD:** `occured_on` is the occurrence date recorded in the case report, while approval date is a different field. This supplement uses occurrence date. The dictionary defines `nibrs_uniq` as a countable-offense identifier. Distinct case counts within crime categories can overlap and must not be summed into unique incidents. No DV flag is supplied in these files. SDPD's RMS data may change or be removed as investigations proceed. Portal metadata says quarterly updates while its narrative describes daily revision; both statements are preserved as a documentation inconsistency. All dates in 2020–2025 have at least one row, which establishes represented dates, **not complete reporting**. [Dataset and dictionary](https://data.sandiego.gov/datasets/police-nibrs/)

**Coverage:** both SANDAG public descriptions say “sample”; their metadata still says January 2021–February 2025 although actual records extend into September 2026. Sycuan appears only through August 2021 in Group A. Coronado and university police do not appear in these acquired public views. Missing agencies or dates cannot be inferred to have zero crime. Most CIBRS status fields are blank, and some rows carry invalid-processing statuses; no status filter was applied. Historical SANDAG documentation cautions that CIBRS counts differ from prior UCR summary counts and SDPD's own RMS extraction. These series must not be concatenated or added together: SDPD overlaps SANDAG's San Diego agency. [SANDAG 2024 methodology](https://www.sandag.org/-/media/SANDAG/Documents/PDF/data-and-research/criminal-justice-and-public-safety/criminal-justice-research-clearinghouse/cj-bulletin/cj-bulletin-crime-in-the-san-diego-region-2024-12-19.pdf)

**Sheriff benchmarks:** the January 2026 report lists 1,816 arrests in January 2025 and 1,127 in January 2026. The March report lists 1,744 and 1,011 respectively. These patrol totals exclude detention facilities, court services and non-Sheriff areas. Current reports exclude PC 849.5 detentions and warn that reviewed totals remain provisional. They demonstrate substantial early-2025 operational activity; they do not identify why the supplied export is sparse. No NetRMS migration explanation is inferred. [January report, page 1](https://www.sdsheriff.gov/home/showpublisheddocument/9924/639080583858770000), [March report, page 1](https://www.sdsheriff.gov/home/showpublisheddocument/10215/639171948673870000), [November 2025 report](https://www.sdsheriff.gov/home/showpublisheddocument/9664/639014781122570000)

The historical annual DV table uses older regional reporting conventions, including data-entry timing; it is not equivalent to officer-flagged Group A incidents. Its source describes monthly agency submissions and agency verification, which does not validate a different export. [Annual-table metadata](https://opendata.sandag.org/api/views/qbrv-e75t.json)

## Sources unsuitable for the requested DV test

[SDPD calls for service](https://data.sandiego.gov/datasets/police-calls-for-service/) explicitly excludes domestic violence, child abuse, suicide, sex crimes and stalking. It cannot measure total DV calls or validate DV-arrest completeness. CAD calls are dispatch activity, not established offenses or arrests.

[ARJIS Crime Statistics](https://crimestats.arjis.org/default.aspx) offers a public monthly query and Excel export for roughly the past two years. It reports UCR Part I categories using a hierarchy rule, permits negative corrections, and warns that regional updates remain incomplete until agency validation. It is useful for monthly context but not interchangeable with the acquired NIBRS incident/offense series. No crime-map portal was scraped.

## Snapshot, privacy and reproduction

`retrieval_metadata.json` records exact query URLs, UTC acquisition times, response hashes and HTTP metadata. `snapshot_audit.json` gives the acquisition interval, date checks and exported schemas. The latest observed date is excluded from any continuity inference. All 2026 values are partial-year, potentially right-truncated snapshots; even earlier dates may be revised. No exposure analysis should interpret reporting lag as a real decline.

`acquire_local.py` uses only Python's standard library. Run `python acquire_local.py`, then `python finalize_local.py`. Queries use the official, unauthenticated SANDAG API and return aggregates only. SDPD CSV bytes are hashed and processed in memory; raw records are not saved. Live reruns may produce different values. `reconciliation.json` verifies source-row sums; `manifest.json` hashes retained outputs. Sheriff values were transcribed from readable official PDF text; direct PDF downloads returned HTTP 403, so no PDF byte hashes are claimed. They are not automatically reproduced by the script.

No person or incident identifiers, victim characteristics, street addresses, coordinates, or individual timestamps are exported. Dates are aggregate calendar dates. Source metadata describes identifier fields but contains no cached example values. No accounts, emails or agency requests were used.

# Curated denominator dictionary

CSV encoding: UTF-8; comma delimiter; blank means unavailable, never automatically zero. IDs are strings; preserve OPEID leading zeros. Counts are students, unless explicitly FTE or proportion. Annual keys are unique `(unitid, year)` pairs.

| File | Rows | Scope |
|---|---:|---|
| enrollment_2022_2024.csv | 126 | 42 institutions × 3 falls |
| institution_crosswalk_verified.csv | 42 | Official IPEDS–Clery identity checks |
| occupancy_2022_2024.csv | 33 | 10 UCs + SDSU; actual fall housing occupants |
| occupancy_auditor_2019_2024.csv | 66 | Same 11 institutions, 6 falls; context extension |
| occupancy_availability_2022_2024.csv | 126 | Complete availability grid; 93 unsourced blanks |
| auditor_ipeds_enrollment_comparison.csv | 33 | Separate headcount sources; 3 SDSU disagreements |
| clery_bulk_enrollment_comparison.csv | 42 | Single Clery field versus fall 2024; all numeric matches |

| Field(s) | Definition / source |
|---|---|
| unitid | Six-character IPEDS reporting-unit identifier, verified against HD |
| opeid | Eight-character OPEID; not globally unique across IPEDS units |
| label, cohort | Frozen study name/group; not inferred from outcomes |
| institution_name | Official HD name for that year |
| year | Fall start year, paired with the same calendar report year |
| fall_headcount_total | EFA.EFTOTLT at EFALEVEL=1; all students |
| undergraduate_headcount, graduate_headcount | DRVEF.EFUG/EFGRAD; graduate includes professional students as classified by IPEDS |
| full_time_headcount, part_time_headcount | DRVEF.ENRFT/ENRPT; attendance status |
| fall_fte | DRVEF.FTE; weighted enrollment equivalents, not people |
| distance_exclusive_headcount | EF_A_DIST.EFDEEXC at EFDELEV=1 |
| distance_some_headcount, distance_none_headcount | EFDESOM/EFDENON; some or no distance courses |
| not_exclusively_distance_headcount | Total minus distance-exclusive; not a validated physical-campus population |
| distance_exclusive_share | Distance-exclusive / total; proportion 0–1 |
| distance_count_derivation | Reported values versus explicitly derived Caltech/Princeton zeros |
| total_imputation_flag, distance_exclusive_imputation_flag | Original source codes: R=reported, A=not applicable; full definitions in EF2024A_dictionary.json |
| enrollment_release | Final revised for 2022/2023 EF; provisional for 2024 EF |
| source_file, source_member, source_variable, source_url | Exact source location; original ZIP hashes in raw_manifest.json |
| denominator_scope, residential_population, calendar_alignment, geography_warning | Required interpretation metadata; enrollment is not residential population |
| hospital_hd_code, medical_school_hd_code | Original HD HOSPITAL/MEDICAL codes; not universal medical-exposure indicators |
| campus_count_clery | Frozen federal reporting branches; not a denominator multiplier |
| unitid_and_opeid_match_verified | Identifier match, not property-boundary equivalence |
| academic_year | Housing report's start/end year label |
| fall_enrollment_auditor | Audit's headcount, retained separately from IPEDS |
| actual_student_housing_occupancy | Enrolled student occupants in Auditor Tables A.1/A.2; not beds |
| denominator_type, capacity_used | Actual-occupancy label; capacity_used=False |
| source_table, printed_page, pdf_page, source_report | Exact table and page; PDF pages are one-based |
| geographic_match_status | approximate_unverified: no Clery property crosswalk established |
| time_warning, numerator_warning | Snapshot and reported-offense interpretation limits |
| status, reason | Availability metadata; not_sourced does not mean zero residents |
| auditor_minus_ipeds | Auditor headcount minus IPEDS; negative for SDSU each year |
| difference | Single Clery field minus IPEDS fall 2024; all zero |

The three official dictionary JSONs preserve NCES definitions, category frequencies, statistics and imputation codes. They are documentary exports, not additional study observations.

The 12 compressed cohort inputs contain the needed public aggregate fields from HD, EF_A, EF_A_DIST and DRVEF for 2022–2024. Their manifest records source ZIP/member/hashes and extract hashes. No student-level or executive-contact data are included.

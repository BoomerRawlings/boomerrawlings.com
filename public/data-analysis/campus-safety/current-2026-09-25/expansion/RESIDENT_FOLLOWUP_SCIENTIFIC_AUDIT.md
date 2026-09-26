# Resident follow-up: independent scientific checks

Checked 26 September 2026. **PASS.** Five additional dated student populations join the previous five expansion records; no offense-cell value, classification, geographic total or source version changes in this follow-up.

| Institution | Observation | Students |
|---|---|---:|
| Yale | Fall 2022 | 6,255 |
| Yale | Fall 2023 | 6,064 |
| Yale | Fall 2024 | 6,011 |
| Yale | Fall 2025 | 6,082 |
| Stanford | Autumn 2023 | 14,137 |

Yale's original Office of Institutional Research housing census names a student headcount, includes undergraduates and graduate/professional students, and specifies fall of the academic year. Its with-partners-or-dependents classification counts students rather than adding family members. Both source tables, four component sums for each year, reference date and closure notes were independently checked; all three PDF pages were visually inspected. The published property scope remains a qualified institutional housing proxy, consistent with the other adopted populations. Current Yale West-campus residential cells are explicitly zero for 2022-2024; no omitted nonzero housing branch was identified. [Yale housing census](https://yaleedu.sharepoint.com/:b:/s/OIRPublic/ETh-cgP0JKxIjKWO0cCYYbMBWWRbAovpNlmyYUWeK9GRkA?e=oaddM8&download=1).

Stanford's complete university-authored 2024 factbook was recovered from an archived original university URL. The file's SHA-1 matches the capture index. The visible housing page states 7,207 students in undergraduate housing and 6,930 in graduate housing in autumn 2023; these classify housing portfolios, not necessarily degree levels. The resulting 14,137-student denominator retains the university-provided-property and overseas-branch qualifications used for its 2024/2025 observations. [Archived Stanford Facts 2024, PDF page 48](https://web.archive.org/web/20240414165344id_/https://facts.stanford.edu/wp-content/uploads/sites/20/2024/01/Stanford-FactBook2024_WEB.pdf#page=48).

The independent general auditor reconstructs all 9,450 rates from 36,652 source cells, independently versioned population inputs and the documented missingness rules. The focused delta review additionally compares every rate row with the previous publication: exactly 90 rows change, exclusively in population and calculated-rate fields; 73 previously unavailable category-level rates become calculable. No reported count, enrollment denominator or unrelated institutional result changes. The source-cell, superseded-cell, geographic and case-study files are byte-identical. Inventory differences are confined to Yale and Stanford adopted-population metadata. The original federal dataset and Crime and Heat PDF remain byte-identical.

Current coverage: 169 population-source rows; 2024 combined housing counts at 33/42 institutions, adopted resident populations and rates at 14/42; 2025 populations at 2/42, complete combined rates at 0/42. Yale's 2025 population does not create a crime rate because matching crime tables end in 2024. No prior year is carried forward. Partial or approximate evidence in the separate resident-evidence ledger does not enter these denominators.

Yale's independently checked combined housing ratios per 1,000 students: 48/6,255 in 2022 = 7.6738609113; 101/6,064 in 2023 = 16.6556728232; 56/6,011 in 2024 = 9.3162535352; pooled 205/18,330 = 11.1838516094. These are administrative ratios using dated population snapshots, not individual victimization probabilities or person-time incidence rates.

Exact input/output hashes, preservation results and the final campus-PDF hash appear in the accompanying JSON. Source transcription and visual review are separate from arithmetic reconstruction. The development-only delta checker requires the recorded previous publication in Git; the packaged `audit_current_data.py` remains the portable all-rate audit.

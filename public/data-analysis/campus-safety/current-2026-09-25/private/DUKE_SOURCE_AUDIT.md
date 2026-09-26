# Duke 2025 report: raster-table extraction

PASS. The [current 2025 Annual Clery Security Report](https://forms.hr.duke.edu/media/oarc/2025-Duke-ASR.pdf) contains three raster crime tables on PDF pages 41–43, printed pages 39–41. All 504 cells were manually transcribed and visually checked: 14 categories × 3 years × 4 geographies × 3 campuses. This is a manual source transcription; no automatic OCR accuracy is claimed.

The retained PDF was retrieved 25 September 2026; HTTP Last-Modified 15 May 2026. SHA-256: `311504825d6edaa9509ad4d4bd3b10bb1af584f399191cbbbcc0605a14cf75ed`. The cover specifies statistics for 2022–2024. The modification date does not turn it into a 2026 report or supply 2025 observations.

| Main-campus criminal-offense sum | 2022 | 2023 | 2024 |
|---|---:|---:|---:|
| On-campus | 85 | 72 | 73 |
| Housing subset | 16 | 4 | 6 |
| Noncampus | 19 | 11 | 6 |
| Public property | 3 | 2 | 3 |

The Marine Lab prints zero for all 168 core cells. Duke in DC prints one public-property robbery in 2022; its remaining 167 core cells are zero. These are observed source values, not imputed missing cells. Main-campus scope includes hospital and medical research areas. The report states that housing is included within on-campus counts; never add housing to the campus total. The DC report states that the program has no on-campus residential property despite displaying zero housing counts; those cells cannot justify a housing-population rate. The main-campus motor-vehicle-theft cell for 2024 is `36*`; the source footnote identifies 14 of the year's motor-vehicle thefts as electric scooters/bikes. The raw asterisk is preserved.

An independent comparison against the frozen federal campus-level dataset found **378 numeric agreements, zero numeric disagreements**, and 126 noncomparable cells: the federal file has blanks where this report explicitly prints zeros. Those 126 are Marine Lab noncampus cells and Duke in DC housing/noncampus cells. The comparison does not overwrite federal blanks. `duke_2025_federal_comparison.csv` retains their source locators.

Run `extract_duke_2025.py` to reproduce the 18-column CSV/JSON from the hash-pinned visual transcription. Run `audit_duke_2025.py` for uniqueness, CSV/JSON agreement, page locators, housing-subset checks, and the independent federal comparison. Source previews are in `duke_audit_renders/`; audit metadata and hashes are in `duke_2025_source_audit.json`. The extraction excludes arrests/referrals, hate-crime narratives, and unfounded-crime totals from the 14 core categories.

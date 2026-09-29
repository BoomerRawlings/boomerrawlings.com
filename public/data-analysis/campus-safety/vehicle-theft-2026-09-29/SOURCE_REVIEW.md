# Motor vehicle theft comparison: source review

Checked September 29, 2026. This supplement documents the new opening comparison and a fresh UC San Diego report check. The larger study, its downloadable report and its institutional-source inventory retain their September 25 snapshot. This supplement does not imply that every university's newest report has been rechecked on September 29.

## Official UC San Diego report

The [official listing](https://police.ucsd.edu/alerts/clery.html) now links a **2026 Annual Security and Fire Safety Report**, covering calendar years **2023–2025**. [PDF page 142](https://www.police.ucsd.edu/docs/annualclery.pdf#page=142) supplies:

| Year reported | Housing subset | On-campus total | Noncampus | Public property | Combined total |
|---|---:|---:|---:|---:|---:|
| 2023 | 6 | 489 | 4 | 6 | 499 |
| 2024 | 8 | 444 | 3 | 10 | 457 |
| 2025 | 9 | 434 | 3 | 2 | 439 |

Housing is included in on-campus totals. Combined totals add only on-campus, noncampus and public-property counts. Page 142 attributes the increase largely to electric scooter and electric bicycle thefts; it supplies no separate car-only count. Page 145 includes attempted theft in the definition, and page 147 defines the geographic categories. These statistics count reported offenses, not necessarily unique people or crimes that occurred during that calendar year.

The 2023 and 2024 motor-theft cells agree with the captured 2025 edition, reissued February 2026. The new 2025 count is shown separately from the 2024 comparison.

## Exact versions and verification

| Edition | Years in table | PDF pages | SHA-256 |
|---|---|---:|---|
| 2026, checked September 29 | 2023–2025 | 451 | `cb739415cf4557c5996eda8f27c9cbd4ba66452c0e452e684711086e47c542f0` |
| 2025, reissued February 2026, preserved study source | 2022–2024 | 459 | `d4d01766e4f4e7de813a320a5484c8a91d7d41b8862a3a15f85d88b0d3a3a0bb` |

Both page-142 tables were rendered and visually inspected. An independent text extraction reproduced all 15 current motor-theft geography cells and checked the three additive totals. Download the [verified cells](ucsd_motor_vehicle_theft.csv) and [source metadata](source_metadata.json). The original university PDFs are linked, not redistributed here.

The official PDF address changes as editions are replaced. No stable official URL for the superseded 2025 edition was located in the listing or targeted official-domain searches. Search results still labeling that address “2025” do not identify the current download. The live 2026 edition does not contain 2022; historical claims retain the [captured source-cell ledger](../current-2026-09-25/source_cells.csv), [versioned calculations](../current-2026-09-25/case_study.json) and [source hashes](../current-2026-09-25/source_inventory.json). A source's absence from a later report does not revise its earlier count.

PDF and server modification timestamps are recorded as metadata, not asserted publication dates.

## Comparison claims and limits

The opening comparison uses **2024 on-campus motor vehicle theft reports divided by fall 2024 enrolled headcount, multiplied by 1,000**. Undergraduate and graduate/professional students are included. Housing counts are not added to the numerator. The enrollment source is the [Integrated Postsecondary Education Data System](https://nces.ed.gov/ipeds/use-the-data/download-access-database), with records retained in the [population ledger](../current-2026-09-25/population_sources.csv).

Recalculation from the published institutional dataset reproduces 444 / 44,256 × 1,000 = **10.03** for UC San Diego and 389 / 26,384 × 1,000 = **14.74** for UC Riverside. UC San Diego is first by count and second by this rate among the nine undergraduate-serving University of California institutions. It is third by rate when San Francisco is included, and third among the 39 institutions with complete figures in the 42-school study. The archived federal data provide all 42 counts and the same UC San Diego positions. [Comparison records](comparison.csv).

The [University of California campus listing](https://www.universityofcalifornia.edu/about-uc/campuses-locations) identifies ten campuses. [UC San Francisco's official overview](https://www.ucsf.edu/about) identifies its distinct graduate/professional health-sciences mission. Excluding it from the nine-campus opening is an explicit cohort choice; the all-ten and broader-study options remain available.

These are descriptive ratios, not student victimization probabilities or exposure-adjusted vehicle-theft risks. Enrollment does not measure the number of vehicles present, parking time, staff, patients or visitors. The rate also does not identify differences in reporting or offense composition. No nationwide ranking or safest-campus claim follows from this selected study. Other years, reporting geographies and comparator groups can produce different rankings.

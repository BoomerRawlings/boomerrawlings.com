# Campus safety: current-source revision, 25 September 2026

This revision is separate from the preserved 2025 federal snapshot. All 42 institutional source listings were investigated; 39 have extracted source tables, including one provisional web-text extraction for Virginia. Merced, Harvard and Johns Hopkins current counts remain unverified. Virginia's provisional values are retained as evidence but withheld from current calculations. An audit cutoff is not a guarantee that a publisher will not subsequently issue another version.

## Using the school guide

The website opens with a short general analysis and no school selected. The visible overview explains counts versus population-adjusted rates, the difference between a reporting comparison and personal risk, the housing subset and missing values. Its coverage finding is specifically the combined listed-offense housing rate for 2024: available for 10 of the 42 schools. Search for a school or browse West, Midwest, Northeast and South; browsing a region does not select a school. Select a school to open its explanation, then choose the reporting period, offense category and location. The explanation updates with the count, eligible population, available rate, report editions and the school's source limitations. Each of the 42 schools has its own scope note and references. A valid school-specific link still opens that school's view.

Regions describe a university's home state, not every reporting branch; medical, satellite and overseas locations may lie elsewhere. Region selection is a browsing aid, not a regional crime-rate comparison. Student housing uses documented residents where available. All on-campus areas uses enrollment. All reporting areas combines the three nonoverlapping Clery geographies and shows counts only because no matched population denominator has been adopted. Missing or withheld results remain unavailable in both the explanation and detailed tables.

The navigation map uses state regions and institutional home-location points to help readers find a school. Nearby-school marker numbers count schools, not crimes. Region colors identify geography; marker size and color do not encode crime rates, safety or data availability. The points come from the retained 2024 institutional directory and the state outlines from a versioned Census-derived map; neither represents offense locations, residential buildings or an institution's complete reporting properties. `map_navigation/MAP_SOURCES.md` records exact versions, projection, regional/inset treatment and licenses. `MAP_NAVIGATION_AUDIT.json` independently checks the 42 points against the original directory. Search and the school list remain alternative ways to select a school.

The detailed rate table and branch-geography explorer remain available below the guide. The guide explains the current institutional series; the detailed table also offers the explicitly labeled federal archive. Neither display ranks institutional safety. `interface/` preserves the guide and map copy, source notes, components and calculation/navigation helpers; `READER_COPY_AUDIT.json` records the independent checks of 9,450 guide selections. Browser interaction and rendered layout are separate checks in `VISUAL_AUDIT.md`. `PRESENTATION_AMENDMENT.md` identifies the presentation changes and the unchanged scientific release and PDFs.

## Reading the data

- `source_cells.csv` preserves the original count/token, category, calendar year, geographic area, report edition, source page/URL/hash, raw status and separate calculation decision. A withheld analysis value does not erase the source's printed number.
- `dataset.json` contains current institutional totals and the unchanged same-year population records from the original study. `rates.csv` contains 9,450 annual/pooled category-measure combinations, including unavailable results. Pooled remains exactly 2022–2024; 2025 is separate.
- `geography.json` supplies the branch-level interface. Housing is included in campus total. Other campus equals campus minus housing only when both are known and consistent. Combined geography equals campus total plus noncampus plus public property. Housing is never added twice.
- `source_inventory.json` identifies the 42 official listings, retrieved editions, actual table years, verification status and limitations. Raw source inventories and independent extraction checks are in `uc/`, `public/`, `private/` and `inputs/sdsu/`.
- `case_study.json` records the current San Diego housing example. SDSU 2024 housing1/campus1/noncampus2/public0 gives combined3; both editions agree. The separate 2023 housing revision7→8 raises its 2022–2024 pooled count17→18 and ratio0.70→0.74. The 2022 cell retains its 2025-edition attribution.

## Missingness and scope

No prior-year population, bed capacity or rounded estimate substitutes for verified 2025 occupancy or enrollment. Rates are unavailable without both a valid count and same-year population. The resident cohort retains all 11 denominator-covered institutions, including unverified outcomes. The 31 other institutions have no adopted resident denominator.

An N/A token alone does not establish absent geography. Only explicitly documented source-scope rules support a structural zero contribution; the raw record remains N/A. A branch before opening or before separate reporting does not become an observed zero. Brackenridge's 2022 reporting was within main-campus noncampus geography; its status does not claim the property had not opened. Dartmouth and UCLA combine domestic/dating categories, so separate-category comparisons are withheld. Other source year labels, printed totals and missing columns are retained as unresolved, not silently repaired.

Current all-branch totals require the relevant source branches. Georgia Tech's three current tables versus four frozen-inventory branches leave its institutional scope unresolved. Florida's new Jacksonville branch opened in 2026 and contributes no separate 2022–2025 scope; Everglades/Vicenza 2025 lack usable outside-agency returns and affected comparisons are withheld. Do not interpret reduced availability as lower crime.

## Versions, denominators and related research

The federal 2025 crime archive and fall enrollment files EF2022A, EF2023A and EF2024A were re-downloaded and their hashes match the earlier inputs (`federal/bulk_rechecks.json`). The federal catalog still lists 2025 as the latest bulk crime collection. The current enrollment-release schedule was checked; no verified fall2025 enrollment file is adopted. Housing occupancy remains the State Auditor's 2022–2024 table, with incompletely matched property boundaries.

The original targeted related-research review remains available in the archived study. This revision rechecks the geographic/report-year regulation and the Bureau of Justice Statistics comparison; it does not relabel the earlier review as a new systematic review. NCES's indicator page could not be freshly retrieved through the web reader; the retained earlier source evidence is distinguished from a fresh verification. Primary links and exact claim qualifications are in `CURRENT_CITATION_AUDIT.md`.

## Reproduction

From the root of an extracted current archive, run these commands with Python 3. The aggregate builder and auditor use the Python standard library:

```text
python build_current.py --frozen inputs/frozen_dataset.json --output replay
python audit_current_data.py --data replay --frozen inputs/frozen_dataset.json --report replay/INDEPENDENT_REPLAY_AUDIT.json
```

This replays normalized aggregates and rates from the preserved source-cell inputs, then independently reconstructs the counts, populations, rates, geographic displays and worked comparisons. A successful check prints PASS; its JSON report goes into `replay/`, preserving the packaged evidence. It does not redownload institutional reports or certify later versions. Compare the replayed `dataset.json`, `geography.json`, `source_cells.csv`, `rates.csv`, `case_study.json`, `coverage.json`, `source_inventory.json` and `build_inputs.json` with the packaged files; the reviewed clean replay reproduced all eight byte-for-byte.

Original PDF re-extraction requires the exact separately identified downloads and acquisition metadata; the archive does not redistribute hundreds of megabytes of institutional reports. The PDF/source citation auditor and JavaScript reader audit retain their original full-project paths and dependencies; copying them into this archive does not make them standalone website builds. With the complete original project available, run `node scripts/test-campus-reader.mjs` from the website root and `node campus_safety_analysis/research/freshness_2026_09_25/audit_reader_copy.mjs` from the shared project root. The archived `interface/test-campus-reader.mjs` is a versioned copy of that website test.

For the standalone map asset, run `npm ci --prefix tooling --ignore-scripts --no-audit --no-fund` and then `node generate_map.mjs campus-map.json` from `map_navigation/`. The lockfile installs the pinned generation tools; the geography and coordinate inputs are already included. Compare the resulting file with `interface/data/campus-map.json`. This does not retrieve new locations or alter the crime analysis. With the full website project available, `node scripts/test-campus-map.mjs` verifies cohort identities, regional display bounds and preservation of schools in desktop/mobile clusters.

`CURRENT_DATA_AUDIT.md` records independent arithmetic/scope checks; `CURRENT_CITATION_AUDIT.md` records the distinct claim/source review; `VISUAL_AUDIT.md` records website and final PDF layout checks. These are computational/source checks, not external human peer review. No source is described as agency-certified.

The archive contains a manifest for its non-archive assets. The website's outer manifest additionally includes the archive's hash; neither manifest hashes itself. Original federal files, numerical results, report and audits remain byte-identical in the separately labeled archived publication.

`RELEASE_PACKAGE_CHECK.json` preserves the identified prior candidate's clean replay and integrity/privacy checks. Later guide and audit additions change the archive hash; this record does not claim to contain the final archive's own checksum. Final archive verification is performed externally to avoid a self-referential hash.

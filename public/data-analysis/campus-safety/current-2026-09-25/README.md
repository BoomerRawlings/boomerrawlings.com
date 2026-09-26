# Campus safety: current-source expansion, 25 September 2026

This revision is separate from the preserved federal archive. All 42 institutions now have extracted institutional report tables, spanning 217 reporting branches. Current products contain 36,652 source cells, 39,268 displayed/derived geography cells and 9,450 annual/pooled category-population combinations, including unavailable results. These figures describe acquisition and calculations, not complete offense reporting or a representative national sample.

For the **2024 combined criminal-offense housing comparison**, 33 of 42 institutions have usable counts; 13 have adopted resident populations; all 13 have a paired rate. Previously those figures were 29, 11 and 10. Five resident observations were added: Carnegie Mellon in 2022, 2023 and 2024; Stanford in 2024 and 2025. Stanford supplies the only adopted 2025 resident population, but incomplete current overseas counts prevent a complete institutional 2025 rate. No 2025 enrollment denominator is adopted. Missing values are not zeros.

`EXPANSION_AMENDMENT.md` is the current scientific-change record. **`PRESENTATION_AMENDMENT.md` and `RELEASE_PACKAGE_CHECK.json` are historical records:** their 10/42 coverage, eight-output replay and earlier campus Portable Document Format (PDF) hash describe the pre-expansion release. They do not verify the new scientific outputs or revised PDF. `EXPANSION_REPLAY_AUDIT.json` records the successful clean ten-output replay and packaged-text privacy check. The final ZIP checksum is listed in the public artifact manifest; an archive cannot contain its own final checksum.

## Using the school guide

The website opens with a general explanation and no school selected. Search for a school or browse West, Midwest, Northeast and South; browsing a region does not select a school. Select a school, reporting period, offense category and location. Its explanation displays the count, eligible population, available rate, report editions and source qualifications. Each institution has its own scope note and references. School-specific links retain their selected view.

Student housing uses documented residents. All on-campus areas uses enrollment. All reporting areas combines campus, noncampus and public-property counts without a population rate, because no matched denominator is adopted. Housing is already included in campus; it is never added again. Missing or withheld results remain unavailable. The detailed table also offers the explicitly labeled federal archive. Neither view establishes a safety ranking or individual victimization risk.

The map is navigation only. Home-campus points come from the retained 2024 institutional directory; state outlines come from versioned Census-derived geometry. Colors identify regions, and cluster numbers count nearby schools. Points and regions do not represent offense locations, residential buildings or every satellite/overseas property. Search and the school list provide alternative navigation. Exact versions, projection and licenses are in `map_navigation/MAP_SOURCES.md`; its independent audit checks all 42 directory points.

`interface/` preserves the guide, map and detailed explorer, source/copy notes, helpers and campus-specific tests. This is a source snapshot, not a standalone website. `READER_COPY_AUDIT.json` covers 9,450 guide selections; `VISUAL_AUDIT.md` records actual browser interaction separately.

## Data and evidence

- `source_cells.csv`: active source tokens/counts, calendar years, categories, four geographies, report editions, locators/hashes, raw statuses and separate calculation decisions. Exclusion does not erase a printed value.
- `superseded_source_cells.csv`: prior cells replaced by exact branch/year/category/geography matches from newer or recovered reports. Original extraction inputs remain available separately.
- `population_sources.csv`: every adopted enrollment/resident observation, source URL/page/hash, reference period and scope qualification. Five additions supplement the retained populations.
- `dataset.json`: current institutional totals with adopted populations and provenance. `rates.csv`: 9,450 annual/pooled combinations. Pooled remains exactly 2022-2024; 2025 is separate.
- `geography.json`: branch-level displays. Other campus is campus minus housing only when both are known and consistent. Combined geography is campus plus noncampus plus public property.
- `source_inventory.json`: all 42 listings, retrieved editions, actual table years and limitations. Report edition and count year are distinct; branches may use different editions.
- `case_study.json`: the San Diego housing example. San Diego State University (SDSU) 2024 housing 1 / campus 1 / noncampus 2 / public 0 gives combined 3. Both editions agree. The separate 2023 housing revision 7 to 8 raises the 2022-2024 pooled count from 17 to 18 and the ratio from 0.70 to 0.74; the 2022 count retains its earlier edition.
- `coverage.json` and `build_inputs.json`: coverage, input identities and reproducible source versions.

`expansion/` contains reviewed aggregate additions, adjudications, source-inventory updates, candidate populations and acquisition/audit evidence. Only comma-separated values (CSV), JavaScript Object Notation (JSON), Markdown and Python evidence are copied; original webpage responses, reports, images and caches are excluded. Earlier evidence remains in `uc/`, `public/`, `private/` and `inputs/sdsu/`.

## Population and count qualifications

The 11 California resident series retain the State Auditor's actual fall occupancy. Carnegie Mellon adds university and separately listed fraternity/sorority housing census counts; its housing office excludes graduate students from on-campus housing. The table is labeled Pittsburgh, although the 2024 total matches university-wide undergraduate enrollment. Stanford adds actual undergraduate and graduate residents in university-provided housing. Its 2024 university-authored factbook was recovered from a publisher mirror after the official file disappeared; identical original official bytes cannot be authenticated. Its 2025 counts come from the current official page.

These are dated fall/autumn snapshots, not annual averages or person-time. Housing properties are not matched parcel by parcel to Clery geography, including remote branches. The same scope qualification applies to retained and new sources. Bed capacity, rounded percentages, incomplete student subsets and populations that may include dependents are not substituted. Texas's 10,018 spring 2024 residents remain a research candidate because the student-only basis is unresolved. An unadopted candidate does not prove no usable public source exists.

Recovered Merced, Harvard, Johns Hopkins and Virginia PDFs now support checked extractions. Harvard's missing geographic columns remain unknown without independent scope evidence. Hopkins's file is titled 2025, says issued October 1, 2026 and tabulates 2023-2025; it was publicly linked before that printed issue date. Both labels are retained. Barcelona's external-agency nonresponse still limits 2025 totals. Virginia's original file agrees with all 1,008 earlier transcribed cells. New Princeton and Stanford main-campus reports add 2025 while older attributable years remain retained.

Not applicable (N/A) alone does not establish absent geography. Only documented structural rules contribute zero to an aggregate; the branch's raw N/A stays distinct from an observed zero. Before opening/separate reporting is not an observed zero. Brackenridge's 2022 coverage belonged to main-campus noncampus geography. Dartmouth, the University of California, Los Angeles, and relevant Stanford source cells combine domestic/dating definitions, so separate-category comparisons are withheld. Year conflicts, inconsistent totals and absent columns are not silently repaired; a clearly supported geographic subset can be retained without restoring ambiguous components.

All-branch totals require relevant branch coverage. Georgia Tech's three current tables versus four frozen branches remain a scope issue. Florida's Jacksonville branch opened in 2026; Everglades and Vicenza 2025 lack usable outside-agency returns. Missing coverage is not evidence of lower crime.

## Versions and related research

Federal crime and enrollment archives remain unchanged. The 2025 crime bulk files and enrollment files EF2022A, EF2023A and EF2024A were reacquired with matching hashes (`federal/bulk_rechecks.json`). The checked federal catalog still listed 2025 as the latest bulk collection. Release labels from other survey components are not adopted as new fall enrollment data.

The original related-research review remains available; this expansion is not a new systematic review. Reporting geography/year definitions, population denominators and the Bureau of Justice Statistics survey comparison have distinct source qualifications. The retained National Center for Education Statistics indicator evidence is not mislabeled as a successful fresh retrieval. `CURRENT_CITATION_AUDIT.md` records exact claim/source uses. Computational/source checks are not external human peer review or agency certification.

## Offline reproduction

From the root of an extracted current archive, use Python 3. The aggregate builder and independent auditor require only the standard library:

```text
python build_current.py --frozen inputs/frozen_dataset.json --output replay
python audit_current_data.py --data replay --frozen inputs/frozen_dataset.json --report replay/INDEPENDENT_REPLAY_AUDIT.json
```

This reconstructs aggregate counts, populations, exclusions, geography and rates from preserved inputs, including `expansion/`. It does not redownload sources or verify later versions. Compare **all ten** replayed products with the packaged files: `source_cells.csv`, `superseded_source_cells.csv`, `population_sources.csv`, `dataset.json`, `rates.csv`, `geography.json`, `case_study.json`, `coverage.json`, `source_inventory.json` and `build_inputs.json`. All ten products replayed byte-for-byte; see `EXPANSION_REPLAY_AUDIT.json`. The old `RELEASE_PACKAGE_CHECK.json` is not this expanded replay result.

Original report re-extraction requires separately identified source bytes and acquisition metadata; those large reports are not redistributed. Full-project source/citation, PDF and JavaScript audits retain their original dependencies/layout. With the original project, run `node scripts/test-campus-reader.mjs` and `node scripts/test-campus-current.mjs` from the website root; run `node campus_safety_analysis/research/freshness_2026_09_25/audit_reader_copy.mjs` from the shared root. `interface/` includes versioned copies of the relevant tests, not their complete runtime.

For standalone map generation, run `npm ci --prefix tooling --ignore-scripts --no-audit --no-fund` and `node generate_map.mjs campus-map.json` from `map_navigation/`. Compare the output with `interface/data/campus-map.json`. This uses packaged coordinates/geometry and changes no crime observations. The full website's `node scripts/test-campus-map.mjs` checks cohort identities, bounds and school preservation through desktop/mobile clustering.

`CURRENT_DATA_AUDIT.md` covers arithmetic and scope; `CURRENT_CITATION_AUDIT.md` covers source use; `VISUAL_AUDIT.md` covers browser behavior; `PDF_VISUAL_AUDIT.md` covers the exact revised report. The internal manifest hashes non-archive assets; the website's outer manifest additionally hashes the ZIP. Neither hashes itself. Original federal artifacts and all Crime and Heat artifacts stay unchanged; the current campus scientific products and campus PDF intentionally change.

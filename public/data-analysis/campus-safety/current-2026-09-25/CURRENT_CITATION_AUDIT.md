# Current claim and citation audit

**PASS — bounded source-support review.** Checked 2026-09-26T04:04:01.876598+00:00. 50 grouped claims; 80/80 repeatable factual/link checks pass.

Reviewed current campus webpage/methods,42-school scope notes, report builder, final current campus report and two-page Crime/Heat supplement. This is separate from numerical reconciliation and formula/layout inspection. It does not certify the institutions' reporting completeness.

## Claim ledger

| ID | Claim family | Support and accurate use | Result |
|---|---|---|---|
| C01 | Cohort and selection: 42 institutions: 10 UC, 8 Ivy and 24 others including SDSU; purposive rather than representative. | PROTOCOL.md; fixed cohort and dataset institutional identifiers. | PASS |
| C02 | Source currency: Audit cutoff is25 September2026 Pacific; original annual reports are now recovered for all42 institutions. Retrieved editions and table years vary, and access does not certify completeness. | Fresh42-school source inventory; recovered Harvard/Merced/Hopkins/Virginia files; new Princeton2026 and Stanford main2026; source-specific original hashes and retained exclusions. | PASS_WITH_QUALIFICATION |
| C03 | Federal archive: 2025 bulk is the latest catalog entry checked; calendar years 2022–2024 remain a separate archived option. | federal/years.json; fileList.json; bulk_rechecks.json exact original/current hashes. | PASS |
| C04 | Report year: An offense is assigned to the year reported to police or a campus security authority, not necessarily occurrence year. | 34 CFR 668.46(c)(3), freshly opened current eCFR, current through 24 September 2026. | PASS |
| C05 | Geographic scope: Housing is a campus subset; combined geography is campus plus noncampus plus public property. Ordinary off-campus community crime is outside these boundaries. | 34 CFR 668.46(a),(c)(5), freshly opened current eCFR; source-table headings. | PASS |
| C06 | Nonadditive counts: Offenses are neither unique people nor report forms; VAWA classifications can overlap core criminal categories. | Federal survey instructions; regulation counting rules; UCSC current p11 multiple-offense disclosure. | PASS |
| C07 | Categories: Eleven specified criminal categories; domestic violence, dating violence and stalking separate. No claim that this includes every newly reportable category. | Archived category dictionary and 2025 survey instructions; current category mappings. | PASS |
| C08 | Branch aggregation: Institution population counted once, branch source scope explicit, ambiguous missing branches withhold relevant comparisons. | Current source-cell decisions and separate numerical audit; original survey campus/UNITID instructions. | PASS |
| C09 | Resident denominators: State Auditor documents actual2022–2024 fall occupancy for ten UCs and SDSU; five added Stanford/CMU observations extend the reviewed population series. Housing properties are not fully matched to Clery geography. | State Auditor PDF62–65; Stanford Facts2025 PDF48 and current housing page; CMU2024 PDF84 and2026 PDF81; exact source fields and sums reread. | PASS_WITH_QUALIFICATION |
| C10 | 2025 populations versus rates: Stanford has an adopted autumn2025 student housing population14,042. Its overseas crime years stop2024, so this does not establish a complete institution-wide2025 rate. No2025 enrollment population is adopted. | Exact2025 housing fields6,727+7,315; current population_sources.csv; branch-year coverage and independent current numerical audit. | PASS_WITH_QUALIFICATION |
| C11 | Enrollment: Optional fall headcount includes undergraduate/graduate, full/part-time and distance-only enrollment; snapshots are not person-time. | IPEDS frozen annual files/dictionaries and source-derived denominator records; unchanged file rechecks. PDF6a now links count sources separately from release schedule. | PASS |
| C12 | Annual and pooled formulas: kC/N; pooled is sum counts / sum same-year population snapshots for exactly 2022–2024, not an unweighted mean or cumulative victimization probability. | Algebra; independent numerical audit; eight worked rows recalculated without production builder. | PASS |
| C13 | Missingness: Unknown cells are not zero; source N/A is preserved and contributes structural zero only with explicit scope evidence. | Current normalization decisions, 48 private structural rules, public/UC scope review, independent numerical audit. | PASS |
| C14 | Historical housing applicability: 103 numeric and 109 absent-housing campuses apply specifically to archived 2024 federal housing, not earlier/current years. | Retained applicability verification and amendment; website explicitly limits claim to that archive. | PASS |
| C15 | SDSU 2024 geography: Housing1 is within campus1; campus1+noncampus2+public0=3. Both 2025 and 2026 editions agree. | Both original PDFs p7, table headings and rape rows re-read. | PASS |
| C16 | SDSU 2023 revision: Current housing rape8 versus prior7; 2022 older-edition9 explicitly retained; pooled17→18 and 0.70→0.74. | 2026 and 2025 SDSU PDF7; current case source-edition attribution; independent arithmetic. | PASS |
| C17 | SDSU 2025 / email: Current 2026-edition table gives 2025 housing10/campus11/noncampus5/public0, combined16; it does not provide complete 2026 calendar figures. | 2026 PDF7 and exact listing-linked hash; newdraft filename caveat; email-only figure excluded. | PASS |
| C18 | UC San Diego: Reissued February2026 report supports annual housing rape12/11/20 and pooled43/58,719=0.73; 2022 campus/noncampus counts revised. | Current UCSD cover and PDF142; prior frozen discrepancy audit retained as historical. | PASS |
| C19 | UC Santa Cruz: 2024 housing rape38 includes 21 offenses in one disclosure; May2026 reissue is cited at PDF11, not the older PDF12. | Current UCSC PDF11 footnote6 and table; current PDF12 correction statement. | PASS |
| C20 | SDSU population discrepancy: IPEDS41,137 versus CDS/State Auditor39,373 remains unresolved, with one consistent optional enrollment source. | Retained denominator reconciliation; SDSU CDS PDF3 undergraduate34,637+graduate4,736; State Auditor PDF64. | PASS_WITH_QUALIFICATION |
| C21 | Descriptive interpretation: No campus significance test, safety ranking, causal effect or individual victimization probability inferred from these ratios. | Study design; incomplete report/population alignment; regulation and repeated-disclosure examples. | PASS |
| C22 | NCES precedent: National indicator uses FTE and scale10,000; not interchangeable with headcount/residents. | Original retained targeted research review and citation audit. Current indicator web retrieval failed; this claim is retained evidence, not freshly recertified. | PASS_RETAINED_EVIDENCE |
| C23 | BJS comparison: Nine-campus pilot illustrates need to align reporting, recall period, geography and population; no universal underreporting correction inferred. | Fresh BJS report review, printed110/PDF131 comparison box. No new numerical claim about national prevalence. | PASS |
| C24 | Audit limitations: Source/citation, numeric and visual checks are distinct; no external human peer review or agency certification claimed. | Explicit website/report qualification and separate dated audit records. | PASS |
| C25 | 42-school notes and regions: Bespoke reporting-scope notes reflect retrieved sources and specific limitations; home-region labels do not describe every branch or relative safety. | School context JSON checked against current source inventory/dataset, source-cell exceptions, private extraction findings, UC/public audit evidence. | PASS |
| C26 | Reader category explanations: All15 selections correspond to the documented category keys:11 criminal offenses, their combined total, and three separate violence/stalking classifications. Descriptions are reading guidance, not exhaustive legal definitions. | Federal survey instructions and category dictionary; no category is relabeled as unique people or every form of crime. | PASS |
| C27 | Reader regions: Four home-region groups plus All regions partition42 schools:West15,Midwest7,Northeast12,South8. Availability statements concern this selected dataset, not regional risk; resident records now include Carnegie Mellon in the Northeast as well as California institutions. | Institution home states and explicit regional assignment; population ledger; updated regionCopy removes California-only limitation. No regional count/rate ranking. | PASS |
| C28 | Reader calculations and narrative: All9450 school/category/year/location selections preserve counts, matching-year populations, rates, missingness and zero distinctions. Combined areas never add housing twice and show no population rate. | Independent audit_reader_copy.mjs reconstructs selected values from current dataset; READER_COPY_AUDIT.json records 23 checks. This verifies explanations against verified aggregates, not source re-extraction. | PASS |
| C29 | Reader pooled interpretation: Housing/enrollment pooling uses summed annual populations; combined-area pooling is explicitly a three-year count, not a rate. An ambiguous partial sum is not asserted to be a known lower bound. | Reader conditional copy inspected; independent all-selection checks; mathematical meaning reconciled with methods. | PASS |
| C30 | Reader citations: School markers derive from the same official-name order as42 source entries after a school is selected. R1/R2 avoid geographyG1 collision. Population links distinguish new exact source/period/scope records from retained state-audit and enrollment inputs. | Reader components and source targets inspected, including current population_sources.csv and selected-year populationSources. Jump/return behavior remains a separate browser check. | PASS |
| C31 | Opening summary: The visible overview distinguishes reported counts and population-adjusted rates from personal risk or safety rankings. Its current13of42 finding is explicitly2024 combined listed housing offenses and reads directly from verified coverage. Housing is a campus subset; missing rates are unavailable, not zero. | Four adjacent citations: current rates.csv; BJS PDF131 reporting-versus-survey comparison; coverage.json plus independent reader arithmetic;34CFR668.46 geography. No national coverage estimate or empirical safety claim. | PASS |
| C32 | Map source identity: The navigation asset contains the42 cohort home-directory locations and50 states plus District of Columbia. It uses retained2024 NCES directory coordinates, Census-derived2017 state outlines and Census regions, not a2026 location survey. | Independent original HD2024 ZIP join confirms every identifier, full institutional name, state and coordinate. Pinned us-atlas3.0.1 topology and generation audit identify state geometry; MAP_SOURCES.md retains versions, source links, limitations and licenses. National view bounds include the western Aleutians. | PASS_WITH_QUALIFICATION |
| C33 | Map interpretation: Map points navigate to institutions; they do not locate crimes, residential properties or every reporting branch. State colors identify regions, uniform markers are not crime or safety encodings, and cluster numerals count nearby schools. | Explicit note with three source citations, navigation-only asset fields, region membership and reader source checks. Selected/hover styling denotes interface state. Actual pointer, keyboard, search, resize and focus behavior is reviewed separately in browser tests. Counts, denominators and rates unchanged. | PASS |
| C34 | Stanford housing provenance: Student-only autumn2024 housing counts7,108+7,095 yield14,203; autumn2025 counts6,727+7,315 yield14,042. The2024 university-authored factbook was recovered from a publisher mirror; original official bytes could not be authenticated. | Reread printed46/PDF48 and current official Student Life/Housing page; metadata hashes match adopted records; mirror qualification appears in methods and source note. | PASS_WITH_QUALIFICATION |
| C35 | Carnegie Mellon housing: Fall2022/23/24 resident proxies sum disjoint University Housing and Fraternity/Sorority Housing rows:3,458/3,764/3,988. Current official policy says on-campus housing unavailable to graduate students; Pittsburgh2024 table total equals all-location undergraduate count, an unresolved scope caveat. | Reread2024 ASR84 and2026 ASR81; current housing-family policy; every component and label verified. No exact parcel match or2025 housing count claimed. | PASS_WITH_QUALIFICATION |
| C36 | Texas housing candidate: Spring2024 report says10,018 residents; it does not expressly establish a students-only count or exclude nonstudent occupants. Candidate remains withheld and is not relabeled fall occupancy. | University Housing and Dining2023–2024 report PDF5 reread; no Texas adopted population; methods and school note expressly explain withholding. | PASS_WITH_QUALIFICATION |
| C37 | Recovered Harvard source: Current2025 report tables supply2022–2024 cells for seven locations. Four omitted residential columns remain unknown; a geographically limited fire appendix cannot establish absent housing elsewhere. | Original ASR PDF70–76 and separate fire PDF2/18–34 reviewed;1,176 cells with378 omitted-geography cells; explicit missing residential records retained. | PASS_WITH_QUALIFICATION |
| C38 | Recovered Hopkins source: Source title2025, issueOctober2026 and statistics2023–2025 remain distinct. Missing columns and unanswered Barcelona police request are not converted to complete university coverage. | Recovered original and independent Hopkins/Stanford source audit; title/date/year scope note copied accurately, without renaming the edition. | PASS_WITH_QUALIFICATION |
| C39 | Princeton current2026 edition: Fresh official listing revealed2026 report at/document/4686. Four visible tables provide336 core cells for Main and Forrestal2023–2025;224 overlapping2023–2024 cells unchanged. Obsolete hidden text ignored. | PDF50–53 visually reread;420 overlay numeric checks;84 geography controls; exact hash and overlap comparison. Root independently reviewed all four rendered pages. | PASS |
| C40 | Recovered Merced and Virginia: Original Merced2025 and Virginia2026 reports now support verified source cells. Virginia6-branch original agrees with1,008 prior web-extracted cells; Charlottesville2024 fondling includes50 incidents in one disclosure. | Merced source audit and original PDF; UVA original-file1008-cell and six-table visual verification; specific Charlottesville footnote. Retrieval fixes do not certify complete underlying reporting. | PASS_WITH_QUALIFICATION |
| C41 | Narrow conflict adjudications: Michigan2024 housing fondling7 is usable independently of the conflicting campus total; missing2024 statutory rape still withholds combined figures. Chicago Gleacher2024 housing burglary0 is independently corroborated absent housing; campus-total conflict remains. | Public CRIME_ADJUDICATIONS.json and original Michigan PDF16–17; private count_adjudications.json and exact-year federal housing declaration. No blanket zero fill or undocumented correction. | PASS_WITH_QUALIFICATION |
| C42 | Expanded source search limits: The resident search distinguished actual students, nonstudent occupants, capacity, rounded percentages, partial populations and mismatched dates. Unsuccessful adoption does not prove no public count exists. | Dated acquisition manifests and candidate ledgers across assigned cohorts. Ivy/Northeast63 source attempts preserve17 candidate rows and no forced whole-institution adoption. | PASS_WITH_QUALIFICATION |
| H01 | Heat refresh counts: 56,793→57,037, net244: 95 newly added-date rows plus149 net earlier-date revisions; mutable rather than append-only. | Freshness audit, source diff and independent offline verification; no arrest/DV substitution. | PASS |
| H02 | Heat upstream scope: 133 requests;131 responses/two failures; specified unchanged DOJ/SANDAG/SDPD/historical weather/Census inputs distinguished from changing whole weather files. | Dated freshness_results and source-by-source audit;97 frozen raw hashes verified,29 historical daily station windows,60 hourly files. | PASS_WITH_QUALIFICATION |
| H03 | Heat outcome distinction: SDPD offense rows are not Sheriff arrests, unique victims or verified domestic-violence cases; partial2026 excluded from fitted models. | SDPD dictionary/source reconciliation and explicit supplement methods. | PASS |
| H04 | Heat reference estimates: Corrected R0 sample64 postal areas/63 fitted DV; +1.91%,p.05287 and +2.74%,p.17903; neither primary p<.05. | revision_models/results/revision_models.csv exact R0 rows. Original wider-sample estimates are not substituted. | PASS |
| H05 | Heat multiplicity / inference: None of24 fixed sensitivity tests has Holm-adjusted p<.05; non-significance is not no association or causation. | revision_tests.csv; separate prior numerical audit; no model refit in freshness supplement. | PASS |
| H06 | Heat geographic/weather gaps: Historical NOAA checks do not prove Open-Meteo panel unchanged; full reanalysis not reacquired and Sheriff latest contents unverified. | Freshness record blocked requests and documentation-only scope; explicit report wording. | PASS_WITH_QUALIFICATION |
| H07 | Heat public aggregates: 1,335 daily and416 monthly cells separately sum to57,037; per-cell distinct cases not additive unique people; source identifiers excluded from released outputs. | offline_verification.json; PUBLIC_FILES.json; aggregate privacy and reconciliation audit. | PASS |
| H08 | Heat source version: Supplement gives exact response SHA and official SDPD source URL; future retrieval may differ. | Freshness request/hash ledger and matching second retrieval documented in offline audit. | PASS |

## Corrections verified

- Current normalization paragraph now cites current audit/rates rather than archived count outputs.
- UCSC citations now target the May2026 reissue at PDF11; the historical research review remains identified as historical.
- PDF6 describes the IPEDS release schedule accurately;6a supplies complete files/dictionaries and source-derived population records. Formula population citations use6a.
- SDSU PDF1 is labeled as the actual linked document rather than a listing page;2022 older-edition use and newdraft filename are explicit.
- Crime/Heat reference estimates explicitly identify the corrected64-postal-area analysis and63 fitted domestic-violence areas.
- School guide population links point to actual housing/enrollment files; the selected school source marker is computed. Combined-area pooled copy describes a count rather than division by populations, and ambiguous partial sums are not asserted to be lower bounds.
- All42 school notes use plain language for populations, locations covered and earlier federal data. Full state names are searchable alongside school names and abbreviations; region labels describe home location only.
- The opening-view amendment removes automatic school selection and San Diego opening highlights. Region browsing does not choose a school. School-specific links, detailed examples, source qualifications, scientific outputs and reviewed PDFs are preserved.
- The opening coverage finding now reads from the current audited2024 combined-housing-rate count:13of42. It retains four direct citations and does not imply a national coverage estimate or safety ranking.
- Five qualified student-housing observations added for Stanford/Carnegie Mellon; Texas spring residents withheld because student-only scope is not established. Previously blocked report files recovered, Princeton2026 added, and exact sources/periods exposed per selection.
- The geographic navigation addition preserves all42 institutional identities and adds versioned directory/boundary/region sources. Independent extent review caught and corrected western Aleutian clipping without changing state paths, school coordinates or scientific measurements.

## Source and review limits

- PASS applies only to reviewed factual/citation claims and recorded artifact versions. It is not certification of complete crime reporting, true victimization risk, matched property-level populations, or agency approval.
- The original related-research review is retained. eCFR geography/report-year provisions and BJS PDF131 were freshly checked; the NCES indicator could not be freshly opened and is supported by the identified prior review rather than relabeled current verification.
- All42 institutional report files are now recovered, including original Virginia. Missing branch/year/geography cells and contradictory values remain withheld. Stanford main2026 and overseas2025 editions differ; Hopkins printed title and table years differ. An official latest listing does not certify unpublished updates.
- This audit reads report text and reference destinations; final rendered mathematical notation, responsive behavior, reference jump/return interaction, deployment, archive manifests and offline reproduction are separate checks.
- Underlying source-cell extraction is covered by separate numerical/source audits. This review directly rereads the principal SDSU, UCSD, UCSC, State Auditor, new Stanford/CMU population and Texas candidate passages, and Princeton/Harvard tables. It does not claim to re-extract every cell at all42 institutions.
- Web addresses are mutable. Institutional originals are identified by saved hashes; an official linked report is not evidence of unpublished updates or final certification.
- The map reuses the retained2024 directory for institutional home navigation. Simplified2017 Census-derived outlines and point-in-state checks do not establish crime location, housing scope, current legal boundaries or property-level population alignment.

## Exact reviewed artifacts

Paths are relative to the shared project root. Changes to these bytes require a scoped recheck. Source/PDF page locators and clickable link annotations are recorded in the JSON sidecar.

| Artifact | SHA-256 |
|---|---|
| `boomerrawlings.com/src/pages/writing/data-analysis/campus-safety.astro` | `fe3929bc632904395a66a1e6597586d546664bb626fc35ca40e2d5c7c1a45236` |
| `boomerrawlings.com/src/content/archive/campus-safety.md` | `f292b2138ba6a6238f434e4aa933bde13df15ed3832f90647361657796e4489a` |
| `boomerrawlings.com/src/data/campus-school-context.json` | `20c25c343db0d37b1a08c05b50597c84f59e68f3f6ed0053fb7f3c8b3a6bbd09` |
| `boomerrawlings.com/src/components/CampusReader.astro` | `560585de3791ca86b7219d3a4430d85b24165f6fd5eb24238e2a9375645413a1` |
| `boomerrawlings.com/src/components/CampusReaderSources.astro` | `9ee763a090f1d5386d282b7ef2410ee38dd5f5a7100fd74641f677130b78aee0` |
| `boomerrawlings.com/src/lib/campus-reader.js` | `7631e418b920336068cd0b62d41cd8921f628f74639bf9ca70de437e1b5119cf` |
| `boomerrawlings.com/src/lib/campus-citations.js` | `1214af7f7a3214afe99d28a3749b99dea0c1a29632157c4658030c79ddd02e56` |
| `boomerrawlings.com/src/data/campus-reader-copy.js` | `1e2d414d5dee563c0a1eb7efffa6d62c433e1e2f04faee15ec8462b7c2b0d17e` |
| `campus_safety_analysis/research/freshness_2026_09_25/READER_COPY_AUDIT.json` | `b963a9bc1f82f06de790a312a861e453c3c9664b29abedf5252549c57b5ab7ad` |
| `campus_safety_analysis/research/freshness_2026_09_25/build_current_reports.py` | `adb5dc3c7de8887bfd2fb4575edf0b4d420e91982e6f6c4ac73107ae1cfa2ccc` |
| `campus_safety_analysis/output/pdf/campus-safety-current-report.pdf` | `f8c7deed2cc17897077b48565f62bd2592f89e9d58a232f62a975ec87cadb97b` |
| `campus_safety_analysis/output/pdf/crime-and-heat-source-refresh.pdf` | `f6ce724d1450fba85601db40b46e5d59122d4191e254e81b5fe06bd517d2cba3` |
| `campus_safety_analysis/publication/current-2026-09-25/dataset.json` | `555d18e4cdbb1fef20b9884ffec8d38286151a9331a9f9bc223e8d70707324ca` |
| `campus_safety_analysis/publication/current-2026-09-25/case_study.json` | `234cfafd586fb8e5643265bcf6acda2b11124668a837bfab743ec1d8a1227eba` |
| `campus_safety_analysis/publication/current-2026-09-25/coverage.json` | `f9820014cce56a68ed747a136f93ca451fbdf58c9165c149b0dbaab635fc3352` |
| `campus_safety_analysis/publication/current-2026-09-25/source_inventory.json` | `2cfe45e8f8c81a43cb6bd22df6afb106fdf149a811ae7fb0dfb25abcfe3b8c06` |
| `campus_safety_analysis/publication/current-2026-09-25/source_cells.csv` | `451895c85221121d5c00d83d38f2929332e32a1d9a50a78cdbd9370ead26069c` |
| `campus_safety_analysis/publication/current-2026-09-25/rates.csv` | `efc2bb0693ad2c7a6adbf9413242d199a599a3ff041ecf8f20572496947d31d4` |
| `campus_safety_analysis/research/freshness_2026_09_25/CURRENT_DATA_AUDIT.json` | `54a2a818e9b1dd9c62bea3b1d3c44ad4997cd048e1fe7a0e549b892f6a54987a` |
| `campus_safety_analysis/research/freshness_2026_09_25/README.md` | `427ab5d27d827fc4d8995dc8c89df17f008fc71802397dd8f77238de00fc6f0b` |
| `campus_safety_analysis/research/freshness_2026_09_25/PRESENTATION_AMENDMENT.md` | `92ce06357edd76ef2df4feb2a64985428f5b3d11301b4fb5615d020a7048ef36` |
| `campus_safety_analysis/research/RESEARCH_REVIEW.md` | `c0d6e3c907508b14654723a338eed3560cea853c57d0fec60f9c631df0eaeed1` |
| `dv_heat_analysis/publication/freshness_2026_09_25/FRESHNESS_AUDIT.md` | `672f2d07fd7606736f1351aa551ca25bcbcf73cc511e5c64f7ee9548a1d57896` |
| `dv_heat_analysis/publication/freshness_2026_09_25/offline_verification.json` | `575ea1c0e1684764aea35102d1e955afeac5ea5844af123203f6af33a6b6d7bf` |
| `dv_heat_analysis/publication/revision_models/results/revision_models.csv` | `6110b0e747f9b224b7184f48cd298c855fb6b23b7bd26c319ac126e600361603` |
| `dv_heat_analysis/publication/revision_models/results/revision_tests.csv` | `3292200e6f71544f571109c2efcc5c5d4d23cd47f8f5d7e44024cca17b3750fd` |
| `campus_safety_analysis/publication/current-2026-09-25/population_sources.csv` | `1cfde5693c35dffd15f7f05d4e1abe3847a356dc7147ffcbd2ee498783e6ed68` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/ivy_northeast/asr_recheck.json` | `72ec1a2657a6699d8c5bccad847779b0c4e49e0cb2bced0ff6c8935c0a8078e3` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/ivy_northeast/population_candidates.csv` | `1102c2935718544a798426c2a9391389339412588597e09eb51622317bb9b1a9` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/ivy_northeast/princeton_2026_source_audit.json` | `31f19a084832bae46420f06c7251781edcd1693f93dd5e33606cf35919f846af` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/private_other/POPULATION_PROPOSALS.json` | `48e21e829962246623536ba327b462601e61ac8731ed14d27584265fe9311029` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/public/CRIME_ADJUDICATIONS.json` | `80c443d9d9ae51bade9835deddf56fec462d87cf86e93b0f4ac704061c35ff02` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/public/UVA_VERIFICATION.json` | `ca605b2175d1a6faf245d7c1468f5d9bfd2f4ff7f01f16306ea20830e5dbdee6` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/california/MERCED_SOURCE_AUDIT.json` | `e4e322e269bd0501f66a9a95d31fbe567168b9ca8ce15f34e5a02b46714804f2` |
| `boomerrawlings.com/src/data/campus-map.json` | `3bb9075b9fdab8086296fc09f09ccf486c7c8da6170f34a3f5e5a7b6cb0af69f` |
| `boomerrawlings.com/src/components/CampusMap.astro` | `dd1684d47dfadb6faf9c2f435e2bfc93a64a266076251b83a66db541e4e271b5` |
| `boomerrawlings.com/src/lib/campus-map.js` | `0e206e63970dbc6629a783d8a5b2e8a7c08eebe47689e8c7cbaa1eaeeeab9727` |
| `boomerrawlings.com/src/styles/campus-map.css` | `e501e5490437c400baf3af34569655bbe79a303bb0dbf10758fc4bf9e7e8447c` |
| `boomerrawlings.com/scripts/test-campus-map.mjs` | `2ea305ea1ee5b7f38f0bd064ffea2f16038402d64221954579ac3e5b68170c3f` |
| `campus_safety_analysis/research/freshness_2026_09_25/MAP_NAVIGATION_AUDIT.json` | `786e413d210ecea42a7f5a55b0963ed3007cde1d5ff9dc3b5064c6e9735f6fec` |
| `campus_safety_analysis/research/map_navigation_2026_09_25/MAP_SOURCES.md` | `597b3caa0c894149e3d8a5042f75319e387fc8cc2b1bda95478d6d36e5104b71` |
| `campus_safety_analysis/research/map_navigation_2026_09_25/MAP_DATA_AUDIT.json` | `9c652ddfd1df33141f905130e405ecb087b08c2081008635eca75e171279fba3` |
| `campus_safety_analysis/research/map_navigation_2026_09_25/hd2024_coordinates.json` | `a336f3b5111fee47d3bf2351811fa925eb7b5aa14a4e9d5d5cd56cb9d0530867` |
| `campus_safety_analysis/research/map_navigation_2026_09_25/states-10m.json` | `d76b391ccfa8bff601d51e3e3da5d43a89fa46cd5caca72ce731b383be5596d0` |
| `campus_safety_analysis/research/map_navigation_2026_09_25/THIRD_PARTY_LICENSES.txt` | `42a13a19ed96fb53db33e6911bb20db6b1b86dcbee3f4092cbe54be383bab5c2` |

## Primary case-source versions

| Saved original | SHA-256 |
|---|---|
| `campus_safety_analysis/research/sdsu_2026/asr_2026_newdraft.pdf` | `8d697b9134573a07dd7d53a0db29c18f8fe3a5b97e026fb8221237766155c80b` |
| `campus_safety_analysis/research/sdsu_2026/sdsu_2025_asr_comparison_source.pdf` | `3242ccb9a6632269bcd68c2cd5e045d3c73af502841519f2b17d2f5985ced4e3` |
| `campus_safety_analysis/research/freshness_2026_09_25/uc/san_diego_report.pdf` | `d4d01766e4f4e7de813a320a5484c8a91d7d41b8862a3a15f85d88b0d3a3a0bb` |
| `campus_safety_analysis/research/freshness_2026_09_25/uc/santa_cruz_report.pdf` | `f50193a642a0e62dee28a533c96e0a0c261a4bf23d32492052b0722e44ae5d83` |
| `campus_safety_analysis/sources/enrollment/raw/2024-111-Report.pdf` | `4057db7b14e1b85bb6980ad19455f873b474358d9f10fd0725e0ac68a24504b6` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/private_other/sources/stanford/factbook2025-mirror-f9a4da8a.pdf` | `ad965bba67967cd78b95bbe8e89e3c993e226f46cb4422827337e9c7a5d42f17` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/private_other/sources/stanford/housing-current-503e49e7.html` | `892dd2c4a33f7cca7a7a55abb94364e61b6eba729ca050ec4f8441f26589926d` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/private_other/sources/cmu/asr2024-aa294bda.pdf` | `5bfdfb888d3b155505f373424323fa9b9dbd1ece311054ec04565f12d21b93ba` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/private_other/sources/cmu/asr-fresh-7c2a7ceb.pdf` | `3d656606897993dc7a03b7d93909b479ceedb78bfee7eae6535bed21a059dbdf` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/private_other/sources/cmu/housing-families-3324c6f1.html` | `abba84ac221410dfd89b494dd7ef620669f4befe9d0ac614ac07afe3333ff3c4` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/public/retrieved/ut_housing_2024.pdf` | `4f1793c6d7761bb3cbedd1dc986cb6bb4a31f1933473bc74df227884081647a0` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/ivy_northeast/raw/princeton_asr_2026.pdf` | `bc5a24834477c9ae9f02fa450e2eb500b676859b384ad20323cd3b39730b5667` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/ivy_northeast/raw/harvard_asr_report.pdf` | `c52024d2154a422a975890555ad0e11fd19790bcfc5d9cf405305edfa6031c3a` |
| `campus_safety_analysis/research/coverage_expansion_2026_09_25/ivy_northeast/raw/harvard_fire_2025.pdf` | `3ee524fed159cb1a42a827c20becc289320e618db6f43a52235975fd951addbb` |

## Audit boundary

The linked current numerical audit verifies joins, sums and withholding decisions. The visual audit checks rendered equations and pages. Release checks separately verify public-file manifests, complete download targets, replayed outputs and deployed interaction. Neither this citation pass nor a successful official-source download substitutes for those checks.

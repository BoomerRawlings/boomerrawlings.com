# Current claim and citation audit

**PASS — bounded source-support review.** Checked 2026-09-26T00:48:46.499243+00:00. 39 grouped claims; 57/57 repeatable factual/link checks pass.

Reviewed current campus webpage/methods,42-school scope notes, report builder, final nine-page campus report and two-page Crime/Heat supplement. This is separate from numerical reconciliation and formula/layout inspection. It does not certify the institutions' reporting completeness.

## Claim ledger

| ID | Claim family | Support and accurate use | Result |
|---|---|---|---|
| C01 | Cohort and selection: 42 institutions: 10 UC, 8 Ivy and 24 others including SDSU; purposive rather than representative. | PROTOCOL.md; fixed cohort and dataset institutional identifiers. | PASS |
| C02 | Source currency: Audit cutoff is 25 September 2026; retrieved editions and table years vary. Blocked and provisional sources are disclosed, not called verified latest records. | Dated 42-school source inventory; current coverage and named exclusions. | PASS_WITH_QUALIFICATION |
| C03 | Federal archive: 2025 bulk is the latest catalog entry checked; calendar years 2022–2024 remain a separate archived option. | federal/years.json; fileList.json; bulk_rechecks.json exact original/current hashes. | PASS |
| C04 | Report year: An offense is assigned to the year reported to police or a campus security authority, not necessarily occurrence year. | 34 CFR 668.46(c)(3), freshly opened current eCFR, current through 24 September 2026. | PASS |
| C05 | Geographic scope: Housing is a campus subset; combined geography is campus plus noncampus plus public property. Ordinary off-campus community crime is outside these boundaries. | 34 CFR 668.46(a),(c)(5), freshly opened current eCFR; source-table headings. | PASS |
| C06 | Nonadditive counts: Offenses are neither unique people nor report forms; VAWA classifications can overlap core criminal categories. | Federal survey instructions; regulation counting rules; UCSC current p11 multiple-offense disclosure. | PASS |
| C07 | Categories: Eleven specified criminal categories; domestic violence, dating violence and stalking separate. No claim that this includes every newly reportable category. | Archived category dictionary and 2025 survey instructions; current category mappings. | PASS |
| C08 | Branch aggregation: Institution population counted once, branch source scope explicit, ambiguous missing branches withhold relevant comparisons. | Current source-cell decisions and separate numerical audit; original survey campus/UNITID instructions. | PASS |
| C09 | Resident denominators: State Auditor tables document actual 2022–2024 fall occupancy for all ten UCs and SDSU, not capacity; property matching incomplete. | State Auditor 2024-111, PDF62–65/printed56–59; original denominator audit. Six worked-example occupancy cells re-read in this review. | PASS_WITH_QUALIFICATION |
| C10 | 2025 populations: No qualified same-year 2025 resident or enrollment denominator adopted; absence of a rate is not an observed zero. | Current source inventory denominator-search notes; coverage.json; unchanged population inputs. This is a study adoption statement, not proof no such population exists anywhere. | PASS_WITH_QUALIFICATION |
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
| C27 | Reader regions: Four home-region groups plus All regions partition42 schools:West15,Midwest7,Northeast12,South8. Availability statements concern this selected dataset, not regional risk. | Institution home states and explicit regional assignment; all11 documented housing populations occur in the selected California public institutions. No regional count/rate ranking. | PASS |
| C28 | Reader calculations and narrative: All9450 school/category/year/location selections preserve counts, matching-year populations, rates, missingness and zero distinctions. Combined areas never add housing twice and show no population rate. | Independent audit_reader_copy.mjs reconstructs selected values from current dataset; READER_COPY_AUDIT.json records16 checks. This verifies explanations against verified aggregates, not source re-extraction. | PASS |
| C29 | Reader pooled interpretation: Housing/enrollment pooling uses summed annual populations; combined-area pooling is explicitly a three-year count, not a rate. An ambiguous partial sum is not asserted to be a known lower bound. | Reader conditional copy inspected; independent all-selection checks; mathematical meaning reconciled with methods. | PASS |
| C30 | Reader citations: School markers derive from the same official-name order as42 source entries; initial SDSU marker isS18. ReaderR1/R2 avoid geographyG1 collision; housing/enrollment links point to actual separate data files. | Reader components and link targets inspected; return targets/select-school handler reviewed. Actual focus and click behavior belongs to the separate browser audit. | PASS |
| C31 | Opening summary: The2024 combined housing-offense ratio is available for10of42 schools; yearly and pooled UCSD/SDSU examples retain their source-specific meaning. | Independent readerResults for criminal_total/housing/2024; coverage.json; previously source-checked case_study.json. Availability is not reported crime prevalence. | PASS |
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
- School guide population links now point to actual housing/enrollment files; the initial school source marker is computed, not hardcoded. Combined-area pooled copy describes a count rather than division by populations, and ambiguous partial sums are not asserted to be lower bounds.
- All42 school notes use plain language for populations, locations covered and earlier federal data. Full state names are searchable alongside school names and abbreviations; region labels describe home location only.

## Source and review limits

- PASS applies only to reviewed factual/citation claims and recorded artifact versions. It is not certification of complete crime reporting, true victimization risk, matched property-level populations, or agency approval.
- The original related-research review is retained. eCFR geography/report-year provisions and BJS PDF131 were freshly checked; the NCES indicator could not be freshly opened and is supported by the identified prior review rather than relabeled current verification.
- Harvard, Johns Hopkins and UC Merced current counts remain unverified; Virginia web-text values remain provisional and excluded. Columbia and Princeton current-listing access restrictions prevent an absolute newest-edition claim. Retrieved-source version/hash is the defensible claim.
- This audit reads report text and reference destinations; final rendered mathematical notation, responsive behavior, reference jump/return interaction, deployment, archive manifests and offline reproduction are separate checks.
- Underlying source-cell extraction is covered by separate numerical/source audits. This review directly rereads the principal SDSU, UCSD, UCSC and State Auditor case passages; it does not claim to visually re-extract every cell at all42 institutions.
- Web addresses are mutable. Institutional originals are identified by saved hashes; an official linked report is not evidence of unpublished updates or final certification.

## Exact reviewed artifacts

Paths are relative to the shared project root. Changes to these bytes require a scoped recheck. Source/PDF page locators and clickable link annotations are recorded in the JSON sidecar.

| Artifact | SHA-256 |
|---|---|
| `boomerrawlings.com/src/pages/writing/data-analysis/campus-safety.astro` | `d91d53a3c048b53036f77661f2a3fae944317dbc1355980a9fc8f76c40f7423a` |
| `boomerrawlings.com/src/content/archive/campus-safety.md` | `b6996cdade8d3ac94fc78774f85651d933be9c9f9813b09c55773e80ea2728c3` |
| `boomerrawlings.com/src/data/campus-school-context.json` | `2a89f6eb25b23878daae794b1a814167cb704762d6e4ed0db64f1c48ee291d75` |
| `boomerrawlings.com/src/components/CampusReader.astro` | `13388f117bb44e567babd95e81f5c1849f2522fe33b56a0513911b93c96b7d1c` |
| `boomerrawlings.com/src/components/CampusReaderSources.astro` | `a19a651fce43028b70cf536a7cdb30b33ea8557218de54205c4395b5a26c7f08` |
| `boomerrawlings.com/src/lib/campus-reader.js` | `dd38608f30b67f8efb0a4df7d5f908ceaef9f930920dc6eb6a26cdb1df39653d` |
| `boomerrawlings.com/src/data/campus-reader-copy.js` | `eb3a423fe7695ccf53d4d8f8d193d1b207c714e6967b63670face89b7a31799a` |
| `campus_safety_analysis/research/freshness_2026_09_25/READER_COPY_AUDIT.json` | `c0f0c4f5cc02b40dd20b0429d3c65086e13cc79c8ca0ba4102ab293300e9d605` |
| `campus_safety_analysis/research/freshness_2026_09_25/build_current_reports.py` | `9c89a4586dbe1315422b8deaffaa944cec655c8130b7216999551f3de688b0c7` |
| `campus_safety_analysis/output/pdf/campus-safety-current-report.pdf` | `58b54176526f25b45466120e7818689af4e636b52f5a30100864289034993f42` |
| `campus_safety_analysis/output/pdf/crime-and-heat-source-refresh.pdf` | `f6ce724d1450fba85601db40b46e5d59122d4191e254e81b5fe06bd517d2cba3` |
| `campus_safety_analysis/publication/current-2026-09-25/dataset.json` | `cf5592b18c1379111248b762bf9447937f0b34383de7ed33e92645e37efac000` |
| `campus_safety_analysis/publication/current-2026-09-25/case_study.json` | `234cfafd586fb8e5643265bcf6acda2b11124668a837bfab743ec1d8a1227eba` |
| `campus_safety_analysis/publication/current-2026-09-25/coverage.json` | `772c88e304eddd6c1946c05c3a3ccc1f118392f4fc9211dc4af947223a17eb4d` |
| `campus_safety_analysis/publication/current-2026-09-25/source_inventory.json` | `31f37ee6f42130b78cf929d68444ddbef81198aa9ae2b2be29833019dc570729` |
| `campus_safety_analysis/publication/current-2026-09-25/source_cells.csv` | `d1eb7fb9c7d485ea3378791f76bd42c88b3c764eea1036148d3e3dffd36a133f` |
| `campus_safety_analysis/publication/current-2026-09-25/rates.csv` | `9e5e58e0a6c816e80237ed018209da81c7e705d702d852be50bcc9056c6d57c3` |
| `campus_safety_analysis/research/freshness_2026_09_25/CURRENT_DATA_AUDIT.json` | `2509dd727f9b7932238a13c8fba346956a416f3a79b26cb8fca02dfea451e08b` |
| `campus_safety_analysis/research/freshness_2026_09_25/README.md` | `ed93415b0352d1a307b048493b90b2d35e61ec0a0704a07930a1dd496a9de5c9` |
| `campus_safety_analysis/research/RESEARCH_REVIEW.md` | `c0d6e3c907508b14654723a338eed3560cea853c57d0fec60f9c631df0eaeed1` |
| `dv_heat_analysis/publication/freshness_2026_09_25/FRESHNESS_AUDIT.md` | `672f2d07fd7606736f1351aa551ca25bcbcf73cc511e5c64f7ee9548a1d57896` |
| `dv_heat_analysis/publication/freshness_2026_09_25/offline_verification.json` | `575ea1c0e1684764aea35102d1e955afeac5ea5844af123203f6af33a6b6d7bf` |
| `dv_heat_analysis/publication/revision_models/results/revision_models.csv` | `6110b0e747f9b224b7184f48cd298c855fb6b23b7bd26c319ac126e600361603` |
| `dv_heat_analysis/publication/revision_models/results/revision_tests.csv` | `3292200e6f71544f571109c2efcc5c5d4d23cd47f8f5d7e44024cca17b3750fd` |

## Primary case-source versions

| Saved original | SHA-256 |
|---|---|
| `campus_safety_analysis/research/sdsu_2026/asr_2026_newdraft.pdf` | `8d697b9134573a07dd7d53a0db29c18f8fe3a5b97e026fb8221237766155c80b` |
| `campus_safety_analysis/research/sdsu_2026/sdsu_2025_asr_comparison_source.pdf` | `3242ccb9a6632269bcd68c2cd5e045d3c73af502841519f2b17d2f5985ced4e3` |
| `campus_safety_analysis/research/freshness_2026_09_25/uc/san_diego_report.pdf` | `d4d01766e4f4e7de813a320a5484c8a91d7d41b8862a3a15f85d88b0d3a3a0bb` |
| `campus_safety_analysis/research/freshness_2026_09_25/uc/santa_cruz_report.pdf` | `f50193a642a0e62dee28a533c96e0a0c261a4bf23d32492052b0722e44ae5d83` |
| `campus_safety_analysis/sources/enrollment/raw/2024-111-Report.pdf` | `4057db7b14e1b85bb6980ad19455f873b474358d9f10fd0725e0ac68a24504b6` |

## Audit boundary

The linked current numerical audit verifies joins, sums and withholding decisions. The visual audit checks rendered equations and pages. Release checks separately verify public-file manifests, complete download targets, replayed outputs and deployed interaction. Neither this citation pass nor a successful official-source download substitutes for those checks.

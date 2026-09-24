# Selected charge-family indicators

These descriptive indicators broaden the explorer beyond domestic violence while retaining **all supplied source-ID groups** as its overall population. They classify recorded charges, not proven conduct, convictions, distinct people, or crime incidence. They are operational, nonexhaustive families, not FBI/UCR/NIBRS offense classifications. No category-specific regression is supplied here.

Every source-scoped ID qualifies once for each category with at least one qualifying charge. Repeated charges do not increase its category count. Categories overlap: for example, 439 source-ID groups contain both a reviewed core-DV charge and a different selected assault/battery/threat charge. Therefore category totals must never be added as a total number of records. Groups outside the selected categories remain in **All records**.

| Category | Operational inclusion | Important exclusions/limits |
|---|---|---|
| All records | Every valid source-scoped ID in the supplied ARREST releases | Includes administrative/warrant records and all unselected charge families; not all community crime |
| Core DV | Existing reviewed exact charge mapping, unchanged | Order-only cases do not qualify; prior counts preserved |
| Drug / paraphernalia | Explicit selected Health and Safety Code families for controlled substances, cannabis, paraphernalia, related premises/proceeds/enhancements, and under-influence charges | Not alcohol-only or every possible drug-related statute |
| Property-related | Selected theft, burglary, burglary-tools, forgery, identity-theft, receiving-stolen-property, vandalism, and vehicle-taking/embezzlement statutes | Not all property offenses or an official property-crime index |
| Other assault / battery / threats | Selected PC 240, 242, 243, 243.4, 244, 244.5, 245, and 422 families, excluding charge rows already classified core DV | “Other” describes selected charge rows; it does not establish a non-domestic relationship. Homicide, robbery, rape statutes, abuse/neglect, and other unlisted violence statutes excluded |
| Weapons-related | Selected weapons, ammunition, magazines, storage/transfer/marking, replicas, and brandishing statutes | Not all gun use or weapons enhancements; includes nonfirearm weapons and replicas |
| Driving-related | Selected DUI, reckless-driving, speed-contest, hit-and-run, evasion, driver-license statutes, and associated enhancements | Includes some infractions; excludes vehicle taking and other unlisted Vehicle Code provisions |

Exact numeric statute-family lists appear in `categories_summary.json`; every observed code/description combination and its assignment appear in `category_mapping.csv`. Codes are matched by code type plus the leading numeric statute family after whitespace removal. Subsections and letter suffixes inherit that family; decimal statutes remain distinct. An explicit `664/` attempt prefix is read separately. Description keywords do not infer unrecorded relationships or offenses. For example, HS 11364 qualifies for the drug indicator; the same digits under another code do not. PC 422 does not accidentally match PC 422.7. The existing reviewed DV classification is checked for all 214,741 valid charge rows.

The family descriptions are informed by California Legislative Counsel's primary code pages: [controlled-substance offenses](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=HSC&division=10.&title=&part=&chapter=6.&article=), [H&S 11550](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=11550), [assault/battery](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=PEN&division=&title=8.&part=1.&chapter=9.&article=), [criminal threats](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=422.), [burglary](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.), [theft](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=484.), [vandalism](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=594.), [forgery](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=470.), [identity theft](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=530.5), [burglary tools](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=466.), [vehicle taking](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=10851.), [weapon provisions](https://leginfo.legislature.ca.gov/faces/codes_displayexpandedbranch.xhtml?tocCode=PEN&division=&title=&part=6.&chapter=&article=&nodetreepath=9), [brandishing](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=417.), [DUI](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=23152.), [licensing](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=12500.), [suspended-license driving](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=14601.), and [hit-and-run](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=20002.). Accessed 24 September 2026. Current statute wording is contextual support, not a retrospective legal adjudication; amendments, charging practices, and enforcement affect comparability over time. The finite mapping is the operative inclusion rule.

## Two populations

The descriptive tables include every source-ID group, retaining unknown/conflicting dimension categories. The daily weather panel uses exactly the prior study's narrower eligibility: resolved date and mapped ZIP; no warrant subtype or detention location; no court category on any charge row; exclusively ADULT subtype. All zero-count calendar ZIP-days remain. The weather estimates, geographic limits, fixed UTC−7 windows, and incomplete-2025 cautions remain unchanged.

| Category | All-source, July 2018–December 2025 | Weather eligible, 2021–2024 |
|---|---:|---:|
| All records | 136,313 | 58,770 |
| Core DV | 12,478 | 6,637 |
| Drug / paraphernalia | 39,172 | 19,749 |
| Property-related | 18,680 | 8,318 |
| Other assault / battery / threats | 9,074 | 4,558 |
| Weapons-related | 5,453 | 3,035 |
| Driving-related | 12,024 | 6,168 |

Weekday-rate tables use the fixed 2021–2024 calendar with every calendar day in the denominator and exclude unresolved dates. Hour tables use the same years but retain the unresolved-hour category. The year/month tables retain unresolved years/months separately. A known year does not resolve a conflicting month. City labels reuse the already reviewed public place whitelist; no source identifiers or street addresses are exported.

## Files and checks

- `category_daily.json`: seven count arrays, ZIP-major, 112 ZIPs × 2,741 dates; index `zipIndex * dates.length + dateIndex`. Its date/ZIP indices align exactly with existing `daily.json`, which supplies weather. Coverage flags are included.
- `category_aggregates.json`: all-source year, month, city, year/city, command, area, ZIP, subtype, race, year/command, year/subtype, weekday, and hour tables, plus fixed-period weekday rates and hour counts. Matching CSVs supplied.
- `categories_summary.json`: labels, complete rules, two population totals, pairwise overlap matrices, citations, verification, source hashes.
- `category_mapping.csv`: 1,602 observed charge-code/description/classification combinations, categories, reasons, charge-row and distinct-group counts. Its distinct-group counts overlap across rows; do not sum them as unique groups.
- `build_categories.py`: standard-library reproducible builder; does not modify earlier outputs or fit models.
- `verify_categories.py` / `verification.json`: independent category ID-set aggregation from the exported mapping, complete daily-cell comparison, and semantic-boundary checks.

The builder asserts exact agreement with all 306,992 existing all-record and core-DV daily cells and all 15 corresponding aggregate tables. Primary-period core DV remains 6,637. Each category cell is between zero and the corresponding all-record count. An independent aggregation path recomputes all seven category arrays from charge-map membership sets rather than using the builder's grouping functions. These tests verify implementation consistency; they do not make the selected taxonomy exhaustive or validate administrative records as crime incidence.

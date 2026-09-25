# Resident-focused opening view

25 September 2026. **PASS — separate resident-focus source/content review.** Browser rendering, interaction and live deployment remain separate checks.

## Reason and scope

At the user's request, the website's opening comparison emphasizes housing residents rather than overall enrollment. The new opening view uses **2024 reported student-housing offenses per 1,000 documented fall residents**, restricted initially to the 11 institutions with a sourced resident denominator. The broader fixed cohort remains 42 institutions; its enrollment-normalized measures and source counts remain available.

This is a change of presentation emphasis after publication. It is not a new source collection, an outcome-selected study cohort, a revision to the frozen analysis protocol, or a new claim about an individual's probability of experiencing crime. The original protocol, scientific inputs, calculated tables and comprehensive report are retained. The report includes both enrollment and residential measures and is identified as the original comprehensive report rather than a newly rewritten resident-only report.

## Numerator and denominator

The opening numerator is the sum of the eleven listed criminal-offense categories in **Clery on-campus student housing**, not all offenses across on-campus geography. Domestic violence, dating violence and stalking remain separately selectable categories and are not added to that combined total. Housing is already a subset of on-campus geography; the two geographies are never summed.

The denominator is **documented fall student-housing occupancy**, not total enrollment, available beds, a rounded housing percentage or an estimated population. The California State Auditor's Tables A.1–A.2 provide three annual occupancy values for each of the ten University of California institutions and San Diego State University: 33 values covering fall 2022–2024. [State Auditor Report 2024-111, printed pages 56–59 / PDF pages 62–65](https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62); [denominator methods](https://boomerrawlings.com/data-analysis/campus-safety/data/DENOMINATORS.md); [occupancy provenance](https://boomerrawlings.com/data-analysis/campus-safety/data/sources/enrollment/occupancy_provenance.json).

The occupancy inventory has not been matched property by property to Clery's housing geography. The interface therefore retains **approximate housing normalization; property boundaries unmatched**. A documented occupant is not necessarily a person represented in the offense count. Reports can involve visitors, nonresident students and nonstudents, multiple offenses, or occurrences before the report year. The ratios remain administrative reporting measures, not resident victimization prevalence or personal risk.

Annual and pooled formulas are unchanged. The pooled numerator sums the three annual counts and the denominator sums the three annual occupancy snapshots. It does not count unique residents across three years or measured resident person-time. Missing counts or population values continue to invalidate the affected rate; zero remains zero.

## Coverage-driven display filter

The initial comparison group is labeled **Documented housing occupancy (11)**. Membership is determined from whether an institution has a documented positive resident population in any study year; it is not determined from the crime count, rate, direction of a comparison, or completeness of the numerator. In the current data, all 11 members have a denominator in every study year.

| Period | Institutions with documented residents | Complete resident-normalized rates | Institutions retained with unavailable rates |
|---|---:|---:|---:|
| 2022 | 11 | 6 | 5 |
| 2023 | 11 | 6 | 5 |
| 2024 | 11 | 11 | 0 |
| Pooled 2022–2024 | 11 | 6 | 5 |

The five institutions with incomplete historical housing numerators are San Diego State University and the University of California institutions at Davis, Irvine, Riverside and San Francisco. They remain in the covered-resident group when an earlier or pooled period is selected. These gaps do not establish zero housing offenses. The original housing-applicability rule remains confined to 2024 and is not backfilled into prior years. [Coverage rules](https://boomerrawlings.com/data-analysis/campus-safety/data/COVERAGE.md); [original coverage amendment](https://boomerrawlings.com/data-analysis/campus-safety/data/AMENDMENT.md).

The other 31 institutions lack sourced resident denominators in this study. Selecting all 42, the Ivy League or another cohort must show those resident rates as unavailable rather than substituting enrollment. Optional enrollment-normalized views use their separately labeled numerator and denominator. The 11-institution opening subset is not nationally representative and does not establish fully matched exposure populations.

For numerical spot checks of the opening combined-category view, San Diego State University has 7 housing offenses / 8,367 residents × 1,000 = 0.836620, displayed as **0.84**. The University of California, San Diego has 52 / 21,907 × 1,000 = 2.373671, displayed as **2.37**. These are not the separate rape-only worked-comparison values of 0.12 and 0.91. [Published annual calculations](https://boomerrawlings.com/data-analysis/campus-safety/data/annual_rates.csv).

## Existing and new saved views

Before this revision, an explorer URL could omit `measure` and `group` because the defaults were enrollment and all institutions. Interpreting an old filtered URL against the new defaults would silently change its meaning.

The implementation therefore restores the legacy enrollment/all-institutions defaults whenever a URL contains a recognized explorer parameter, then applies valid explicitly supplied selections. An old URL containing only `sort=rateDesc` continues to mean the enrollment comparison across all 42 institutions. An old URL with `measure=residents` but no group retains the all-institutions cohort. Explicit resident/enrollment, cohort, category, year and scale selections retain their meanings.

Newly saved/shared URLs write both `measure` and `group` explicitly, including when they match the new opening defaults. A clean visit to the route uses the resident-focused opening view. Unrelated tracking parameters alone do not constitute an old explorer selection. The bare route cannot simultaneously encode both the historical default and the new default; its documented opening behavior changes with this revision.

## Independent source/content review

The resident-focused page, methods text, explorer defaults, cohort filter, saved-view compatibility logic, citation entry, new regression script and test command were reviewed after implementation. Existing source-backed meanings of housing counts and occupancy were retained; the scope of the change is presentation rather than new data collection or geographic reconciliation.

- Independently checked **60 category-by-period configurations**: all 15 categories over 2022, 2023, 2024 and the pooled period. Each retains the same 11 denominator-covered institutions. All 11 have documented population values in each selection; 11 rates are available in 2024 and six in each earlier/pooled selection. No outcome-dependent institution removal was found.
- The all-institutions residential view retains **31 unavailable resident rates**. The eight Ivy League institutions retain unavailable resident rates rather than enrollment substitutions. The optional all-institutions enrollment view remains available for all 42 institutions.
- Independently compared the **11 server-rendered default rows** with the frozen 2024 residential counts and occupancy values. Every count, population and two-decimal rate agrees. The caption and denominator heading identify housing reports and fall occupancy.
- Checked legacy default-selection fixtures and clean/tracking-only visits, and inspected the explicit `measure`/`group` serialization. The added regression script also tests explicit legacy selections and a new resident-default URL. This source/code review is separate from exercising actual browser history, reload and sharing behavior.
- The compiled study retains **seven mathematical expressions**, now with **52 numbered citation occurrences, 52 matching return links and 33 source entries**. Independent traversal found no duplicate IDs, missing citation targets or unmatched occurrence return links. The new reference identifies this amendment; prior primary-source locators are retained.
- All **ten original scientific/protocol/report artifacts** and the preceding abbreviation/source-navigation revision record remain byte-identical to their reviewed versions. The original report remains SHA-256 `8a0efc6be9634ac85d7fe815c153961e721ac24e714fe66e8cdd5df05eceaa88`. No numerical output was regenerated or denominator estimated for this revision.

The original study's numerical, source-reading and PDF review counts are retained for those unchanged artifacts; they are not represented as newly performed reviews. Responsive browser behavior, the complete regression run, package integrity and deployed-site verification are separately recorded by the implementation owner. This clearance does not pre-certify their completion.

## Audit continuity

The appended `presentation_revisions` entry in `citation_claim_ledger.json` preserves the complete preceding review map before recording updated website, test-command and amendment hashes. Earlier presentation and source audit records remain historical evidence of their stated versions. The current top-level hashes identify the files cleared by the latest scoped review.

The source documents still cannot establish complete reporting, matched housing-property populations, personal victimization risk, or equivalent safety between institutions. Changing the opening view does not remove those limitations.

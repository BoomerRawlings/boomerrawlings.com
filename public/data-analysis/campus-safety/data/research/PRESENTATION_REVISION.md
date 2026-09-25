# Campus study presentation revision

25 September 2026. **PASS — separate presentation source/content review.** Browser layout, interaction and final deployment checks are recorded separately.

## Scope

This revision adds column-heading sorting, first-use name/term expansion, definitions on abbreviations, and numbered links between study text and a source list. It does not change the study's source counts, populations, rate formulas, category definitions, or report. The existing source/content and numerical audits apply to their originally recorded artifact versions. This document records a separate review of the changed presentation. The original source-reading checks were not repeated for unchanged scientific inputs; their results and artifact identities are retained.

## Institution names and source labels

All 42 records in `publication/data/dataset.json` already contain `officialName`, derived from the frozen institutional source inventory. Use those names for full institutional labels. `name` and `shortName` are presentation labels and remain unchanged in source data. Common short forms such as MIT, NYU, UCLA and USC therefore have a documented full-name counterpart without a new institutional join.

The 212 reporting-campus labels are source strings. Definitions may annotate those labels but must not silently alter the historical inventory. A current institution page can verify an abbreviation without establishing that the campus's administrative scope is unchanged since the study period. In particular, the frozen NCEF label is retained even though the institution's current page uses NCF; the historical source below explicitly defines NCEF. The same principle applies to the Marine Biological Laboratory's historical affiliation with the University of Chicago.

Institution abbreviations derived directly from the matching official name include UC, UCSD, UCSC, UCSB, UCSF, UCLA, UCB, UCD, UCI, UCM, UCR, SDSU, USC, MIT, NYU, CMU, CU (in the Columbia campus context), JHU, UF, UVA, UT (in the Texas campus context) and UChicago. A global case-insensitive replacement is inappropriate: initials such as CU or UT and state codes require their institutional/location context.

## Verified branch-label definitions

These checks establish names, not additional crime statistics. Primary institution pages were consulted on 25 September 2026.

| Label | Full name or definition | Primary evidence |
|---|---|---|
| MBL | Marine Biological Laboratory | [University of Chicago affiliation questions](https://news.uchicago.edu/story/frequently-asked-questions-university-chicago-mbl-affiliation). The named laboratory corresponds to the frozen campus label; this does not assert a current affiliation. |
| DRCLAS | David Rockefeller Center for Latin American Studies | [Harvard center: About Us](https://www.drclas.harvard.edu/about). |
| UNDERC | University of Notre Dame Environmental Research Center | [Center's official site](https://underc.nd.edu/). |
| IFAS | Institute of Food and Agricultural Sciences | [University of Florida college site](https://cals.ufl.edu/) and [official 2019 briefing book](https://extadmin.ifas.ufl.edu/media/extadminifasufledu/ext-admin-new/documents/2019-Briefing-Book.pdf). |
| CALS | College of Agricultural and Life Sciences | [University of Florida college site](https://cals.ufl.edu/). |
| NCEF | Naples Children & Education Foundation | [University of Florida's 21 June 2019 center account](https://dental.ufl.edu/2019/06/21/identify-a-problem-work-toward-a-solution-ncef-pediatric-dental-center/). This is the historical expansion matching the frozen label, not a substitution of the current foundation name. |
| SAIS | School of Advanced International Studies | [Johns Hopkins school directory](https://sais.jhu.edu/offices-directory). |
| UTLA | University of Texas Semester in Los Angeles Program | [University of Texas program description](https://theatredance.utexas.edu/ut-semester-los-angeles-program). The definition distinguishes this university program from the unrelated teachers' union with the same initials. |
| LBJ | Lyndon B. Johnson | [Washington Center director's introduction](https://dc.lbj.utexas.edu/welcome-director) and [university account identifying the Lyndon B. Johnson School](https://news.utexas.edu/2015/03/24/luci-baines-johnson-and-ian-turpin-give-1m-gift-to-lbj-school-washington-center/). Personal initials; not a newly named institution. |
| MBA | Master of Business Administration | [University of Florida graduate catalog](https://gradcatalog.ufl.edu/graduate/colleges-departments/business/interdisciplinary-departments/business-administration-mba/). |
| REEF | Research and Engineering Education Facility | Expansion is present in the frozen source label itself: `UF Research and Engineering Education Facility (REEF)`. |

Personal initials in named buildings, such as `J.J. Pickle`, are not expanded speculatively. Ordinary source words written in capitals, such as `HOMEWOOD CAMPUS, BALTIMORE, MARYLAND`, are not acronyms.

## Study and file-format terms

| Term | Meaning in this study | Evidence/qualification |
|---|---|---|
| VAWA | Violence Against Women Act | Existing federal Campus Safety survey instructions and regulation, retained in the source/citation ledger. |
| ASR | Annual security report | Existing federal instructions and the institutional annual reports. |
| IPEDS | Integrated Postsecondary Education Data System | Existing enrollment dictionaries and National Center for Education Statistics source documentation. |
| UNITID | Unique institution identifier in IPEDS | A source-field label; do not invent a literal expansion. |
| NCES | National Center for Education Statistics | Existing national indicator and enrollment documentation. |
| FTE | Full-time equivalent | Existing NCES campus-crime indicator; this remains distinct from headcount. |
| BJS | Bureau of Justice Statistics | Existing Campus Climate Survey Validation Study. |
| CFR | Code of Federal Regulations | Existing 34 CFR section 668.46 citation. |
| U.S. | United States | Geographic abbreviation. |
| API | Application programming interface | [MDN glossary](https://developer.mozilla.org/en-US/docs/Glossary/API). |
| PDF | Portable Document Format | [Adobe format description](https://www.adobe.com/acrobat/about-adobe-pdf.html). |
| CSV | Comma-separated values | [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180). |
| JSON | JavaScript Object Notation | [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). |
| URL | Uniform Resource Locator | [RFC 1738](https://www.rfc-editor.org/rfc/rfc1738). Used here only to define the label, not as current browser-parsing guidance. |
| SHA-256 | Secure Hash Algorithm with a 256-bit digest | [NIST Secure Hash Standard, FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf). |
| ZIP | Compressed archive format | Format name, not an acronym requiring a fabricated expansion. |
| p.; pp. | Page; pages | Bibliographic abbreviations. |

State codes in the cards are CA, CT, DC, FL, GA, IL, IN, MA, MD, MI, NC, NH, NJ, NY, OH, PA, RI, TX, VA, WA and WI. Their expansions are California, Connecticut, District of Columbia, Florida, Georgia, Illinois, Indiana, Massachusetts, Maryland, Michigan, North Carolina, New Hampshire, New Jersey, New York, Ohio, Pennsylvania, Rhode Island, Texas, Virginia, Washington and Wisconsin, respectively. [United States Postal Service, Appendix B](https://pe.usps.com/text/pub28/28apb.htm). The same district is written `D.C.` in some source labels; `Md.` denotes Maryland.

## Independent revision review

The revised page, methods text, explorer, sorting helper, definition dictionary, static abbreviation and citation renderers, browser annotation/tooltip helper, wrapper components and presentation styles were read separately from implementation. The new name/format definitions were checked against the primary sources listed above. Existing scientific claims and qualifications were compared with the prior source text and claim ledger.

- All **42 institutional display-name expansions** agree with the existing `officialName` field, allowing only the documented University of California hyphen-to-comma presentation change. Native select options use full names. Sort labels now explicitly specify full institutional names; exports identify institutions by their original official name and source identifier.
- All **212 frozen reporting-campus labels** remain text-identical when passed through the verbatim annotation renderer. Formal bibliography titles similarly retain their original words; existing shorthand is annotated rather than rewriting a historical title or campus label.
- Study prose expands the first term use and annotates subsequent abbreviations. The source code excludes data scripts, mathematical markup, code blocks and location-context text. First-use tracking is recomputed after interactive changes; hidden option labels do not consume it. States are written in full in the cards.
- The compiled page has **51 numbered citation occurrences, 51 corresponding return links and 32 source entries**. Independent markup traversal found no duplicate IDs, missing citation targets or unmatched occurrence return links. Exact repeated URLs share a reference; differing page/section locators remain distinct. Explicit downloads remain download links.
- The unchanged institutional report locators remain University of California, San Diego page 142, San Diego State page 7, University of California, Santa Cruz printed page 11 / PDF page 12, and State Auditor printed pages 56–59 / PDF pages 62–65. The new definition-source note links to this revision record.
- All **seven mathematical expressions** remain in the compiled page. The underlying annual and pooled formulas are unchanged. Sorting operates on unrounded numeric values, keeps unavailable fields last, and retains observed zeros; selecting a sort changes presentation order, not a rate.
- All **ten original non-website artifacts in the citation ledger** remain byte-identical: dataset, worked comparison, annual and pooled tables, report, protocol, related-research review, source-value verification, institutional comparison verification and residential-applicability verification. The seven-page report remains SHA-256 `8a0efc6be9634ac85d7fe815c153961e721ac24e714fe66e8cdd5df05eceaa88`.

The implementation owner separately exercised all eight sort orders, missing values, URL reload, source-to-occurrence navigation/focus, and definition tooltips by click/focus/Escape. Those are attributed implementation checks, not independent browser observations by this source reviewer. Responsive screenshots, equation appearance, package integrity and deployed behavior have separate release checks; this record does not pre-certify their completion.

## Audit continuity

`citation_claim_ledger.json` retains the original scientific claim families and check counts. Its `presentation_revisions` entry preserves the full original hash map and records this review's limited scope. The current top-level hash map identifies the revised website sources and this record. The original table in `CITATION_AUDIT.md` remains an accurate record of the original review rather than being silently rewritten as though its source checks had occurred again.

This is a presentation revision, not a new statistical collection or a new interpretation of campus risk. No source count, population, missingness rule, category sum, scope qualification, or PDF byte was changed. The unresolved enrollment and housing-boundary limitations remain in force.

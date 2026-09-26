# Interface and formula audit

Audit date: September 25, 2026. Local production preview: port 4326. This record separates static checks, direct PDF inspection, and browser interaction evidence; one is not substituted for another.

## Static preview and calculation checks

`static_interface_checks.json` records the checked preview and imported pure calculation functions. The served default contains 11 institutional rows with 10 current-source resident rates; the archived federal dataset yields 11 rates under the same default selection. All eight orderings, covering four columns in both directions, pass for both datasets; unavailable numeric values remain last. An absent 2025 year in the federal archive yields unavailable counts, populations, and rates, not zero. Legacy parameter defaults retain enrollment/all-institution interpretation.

The server-rendered geographic table correctly shows San Diego State's 2024 rape counts: housing 1; other campus 0; campus total 1; noncampus 2; public property 0; combined 3. Served 2025 cells are housing 10/campus 11/noncampus 5/public 0, supporting other campus 1 and combined 16. Palm Desert's explicitly absent housing is distinct from its unknown noncampus count. UCLA's combined domestic/dating categories and provisional Virginia cells are withheld, not rendered as zero.

The default geographic citation has six exact source markers and six matching return targets. The served page has no duplicate IDs or unresolved internal fragment targets. Seven MathML equations are present. Main year options are chronological with the 2022–2024 pooled option last; geographic year options are chronological. Native category and institution options contain full terms. Both default tables and the methods remain in the HTML without JavaScript. These are structural checks, not a claim that disabled-JavaScript rendering was visually inspected.

The Crime and Heat page contains the refreshed 57,037-record figure. Static data and calculations do not establish actual click/focus behavior or a successful responsive layout.

## Geographic component integration checks

The component and its client script compile. Targeted fixtures verify missing/duplicate/conflicting records remain unavailable, housing is not added twice, explicit no-geography statuses are distinguished from raw zero, and periods before opening do not produce derived branch totals. The component's abbreviation annotator was adapted to the explorer's `{current, federal}` embedded-data structure; it now supplies all 42 institutional definitions after each geographic render. This avoids removing institutional abbreviations when the geographic fetch completes.

## PDF inspection

See `PDF_VISUAL_AUDIT.md` for the complete scope. All nine campus-report pages and both Crime and Heat supplement pages were directly rendered and inspected again after final regeneration. Both displayed campus equations have intact fraction rules, subscripts, summation signs and limits. No clipping, missing glyphs, overlapping text, or broken table rows was observed. Offense/year labels and the unverified-edition label were corrected and visually rechecked. Final campus hash: `58b54176526f25b45466120e7818689af4e636b52f5a30100864289034993f42`; final Crime and Heat supplement hash: `f6ce724d1450fba85601db40b46e5d59122d4191e254e81b5fe06bd517d2cba3`.

## Browser evidence status

The reviewing child agent could not access a browser: browser inventory returned no surfaces, and attempts using both the in-app alias and the parent-observed browser/tab IDs returned unavailable. This record therefore **does not claim** desktop/mobile screenshots, actual sorting clicks, source jump/focus/return behavior, tooltips, source switching, or legacy-link navigation were independently exercised by this agent. The parent reviewer will record its direct browser results separately before release.

Source/citation fidelity and numerical verification remain separate audits. Nothing in this visual record constitutes human peer review, agency certification, or evidence that missing source data are complete.

## Parent browser verification — final guided interface

Directly exercised the local production preview after the September 25 redesign using the in-app browser. This evidence is separate from the child agent's static review.

- Desktop1280, mobile390 and narrow320: school finder and result cards inspected visually; no document-wide horizontal overflow. Region buttons and school cards wrap; result labels and unavailable values remain readable. Search is placed before regional context to keep navigation easy to reach.
- Search accepts SDSU, Harvard, UCLA and full state name California (14 matching institutions). Unmatched text shows a recovery message. Region selection works with Enter; selected states and school headings update. All42 bespoke explanations and all9,450 combinations are covered by separate calculation/copy tests.
- SDSU guide:2024housingrape1/8,367=0.12; all reporting areas3.2025combined16 and no rate. Selecting geographic detail updates the correct school, main branch, year and category after the geographic data load completes. Imperial Valley2024rape zeros remain numeric; Harvard unverified counts remain unavailable. UCLA2024 domestic-violence conflict stays unavailable despite a documented population.
- Every table heading exercised twice: all four columns reverse, keyboard focus survives rebuilding, unavailable counts/rates stay last. Current default has10 available rates; federal archive11.2025haszero available rates; reset restores2024/current/housing defaults. Legacy links retain federal/enrollment/all semantics; guide-to-table links explicitly retain current source and selected school/category/period.
- School source marker opens its reference disclosure; return link restores the corresponding school's explanation. All in-page fragment targets resolve; no duplicate IDs. Definitions appear on touch/click and keyboard focus. No browser JavaScript errors observed.
- Detailed sections open when following their fragment links. All seven MathML expressions retained. Both displayed equations inspected at desktop and320px: fractions, subscripts and summation limits intact; no clipping or equation overflow.

The geographic data are loaded asynchronously; the labeled default2024 table remains while loading. Checks distinguish reports from distinct incidents/people, home-region grouping from branch geography, missing values from zeros, and no population basis from a zero rate. These browser checks do not certify institution reporting completeness or external peer review.

## Simplified opening — supersedes the prior automatic school selection

September 25, 2026: the opening now contains a broad introduction and school/region finder. No school, school cards or case study is selected or shown before a reader searches or chooses a region. Region choices browse schools without selecting one. Coverage notes and both reference lists are collapsed until requested; the detailed research remains available.

Parent directly verified the final local build at desktop1280, mobile390 and narrow320. No initial visible UCSD/SDSU references, no default selected school, and no document-wide horizontal overflow. Every region, including Browse all schools, leaves the school report hidden until a school button is selected. Search alone also leaves it hidden. Explicit SDSU and Harvard selections, a UCSD school deep link, a Northeast region deep link, and source/return navigation work. Research citation links open the relevant collapsed references and return to the body. No duplicate IDs or browser console errors observed. The final390px screenshot places search and all five region choices in the opening screen below the short introduction.

Scientific data, mathematical expressions and PDFs are unchanged; prior equation/PDF evidence remains applicable. This section supersedes the earlier descriptions of a preselected San Diego State guide and automatic selection upon a region change.

## General-reader overview follow-up — 25 September 2026

The neutral opening now includes a visible general explanation before the school finder: counts versus population-adjusted rates, personal-risk limits, 2024 combined housing-rate availability, missingness and reporting geography. No institution is singled out. Local rendered desktop1280, mobile390 and narrow320 views pass: readable text, no horizontal overflow, school result hidden and detail disclosures closed on launch. All four new citations have valid source targets and return links; an actual coverage-citation jump opens its bibliography and its return link reaches the overview. Browser console has no errors. Temporary viewport overrides reset. No formulas, scientific results or PDFs changed; the earlier checks of those unchanged artifacts remain applicable.

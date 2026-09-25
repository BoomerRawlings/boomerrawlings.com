# Website, mathematics and interaction audit

25 September 2026. **PASS** for the tested desktop and mobile presentation. This is a rendering/interaction check, separate from the numerical and citation audits. Live deployment remains a separate release check.

## Website

- Inspected the production-build preview at 1280 px, 390 px and 320 px. No page-level horizontal overflow. Wide data tables retain their own labeled horizontal-scroll regions; long native-select values can truncate visually but retain full options and accompanying definitions.
- Verified the annual and pooled equations visually on desktop and mobile: true fractions, italic variables, subscripts, roman pooled label, and summation limits 2022 through 2024. Seven MathML expressions are present: two display equations and five inline variables; no KaTeX errors. Both display boxes fit their available width without clipping.
- Reviewed the header, controls, results table and two-institution detail cards. Rates receive visual emphasis while counts and denominators remain available. Paired bars share one zero-based scale; missing values are labeled unavailable.
- Exercised UC and Ivy filters, rape and domestic-violence categories, resident and enrollment denominators, annual/pooled periods, both rate scales, rate sorting, search, empty results and reset. The ten UCs have ten resident-normalized 2024 rape rates; the strict pooled residential view has six available UC rates. Ivy resident rates remain unavailable rather than becoming zero.
- Keyboard Enter opens the selected institution detail; focus moves to the detail heading. A filter URL survives reload with the same category, population, cohort and scale. Actual CSV export produced ten UC rows with the selected 2024 resident denominator and 10,000 scale. Browser download-event observation timed out, but the resulting downloaded file was located and independently checked.
- No browser errors or warnings observed during the tested interactions. The default 42-row table, methods and download links are server-rendered; no-JavaScript fallback markup is present. A browser session with JavaScript disabled was not separately exercised.

## PDF

Independent reviewer inspected all seven pages, both vector equations, grayscale samples and all 57 displayed table rows. A citation review clarified the BJS comparison as rape incidents; the changed page was re-rendered and checked. See [PDF_VISUAL_AUDIT.md](PDF_VISUAL_AUDIT.md) for the exact final PDF hash, row checks and page-by-page findings.

## Calculation and publication checks

The website check script compares browser-helper calculations with all 7,560 Python-produced annual/pooled rates and tests unequal-denominator pooling, missing values, zero counts, category sums, rate rescaling, CSV escaping, manifest hashes and mathematical markup. Those checks are run as part of the publication build. Source-version and geography uncertainties remain as stated in the methods; visual correctness does not resolve them.

## Presentation revision: sortable headings and source navigation

25 September 2026. **PASS** on the production-build preview; these checks supplement the original review above.

- All four table headings sort in both directions. Browser-observed values were ordered correctly in all eight states; the dropdown, direction arrow, `aria-sort`, URL and keyboard focus agree. Missing resident populations remain last, and the selected ordering survives reload. Institution ordering uses the full source name.
- First-use expansions and later abbreviations were inspected in static and interactive content. Native options retain full names. Definitions appear on pointer/focus/touch interaction; Escape dismisses the tooltip. The revised mobile tooltip stays within the content viewport. Source titles and reporting-campus strings remain verbatim, with definitions applied only to shorthand.
- All 51 numbered subscript citations connect to 32 source entries, with 51 return links. A housing-occupancy citation was followed to the correct source and returned to the exact occurrence; focus followed the return target. Source highlighting and readable wrapping were visually checked at 390 px.
- Desktop and 390 px table/controls screenshots show readable full-name labels and visible sorting indicators. At 320 px the page has no horizontal overflow, and both display equations fit their available 273 px without clipping. All seven MathML expressions remain present. No console errors or warnings appeared during these checks.
- The PDF and statistical data are unchanged. The separate source/content review and definition provenance are recorded in [research/PRESENTATION_REVISION.md](research/PRESENTATION_REVISION.md). Live publication verification follows packaging.

# SUBS catalog and Sources

- Scope confirmed: military classes and unique physical prototypes; construction begun qualifies. No civilian craft or paper-only proposals. Plain type/design + origin rows; no per-design links.
- 659 records, 32 country/historical-origin labels, 337 unique source URLs. Three independently researched regional datasets plus cross-region alias/gap audit; uncertainty and taxonomy limits in `docs/subs/CATALOG.md`.
- Sources at top right stays reachable in sticky header; opens native modal of raw hyperlinks. Escape and Close return focus; filter state preserved.
- Search matches type/origin, accents/case normalized; country matches joint origins; 50 records per page. Clear restores all records/page1. No storage or new remote runtime requests.
- Full `npm test` passes. Six existing gate + four new catalog behavior tests pass. Publication verifier checks all rendered records/columns, raw URL labels, source metadata and unlisted sitemap.
- Browser on final build: Virginia → one US result; Germany filter combined with Virginia → no results; Clear restores all. Japan → 62 results; next page → remaining12. Sources raw URLs, Escape/close focus return, desktop top-right position and 320px table/dialog no-overflow verified. Riddle still required on fresh reload; skip/return behavior retained.
- No production-preview catalog script errors. One historical Astro dev-toolbar fetch error occurred after the separate dev server stopped; not included in published output.
- Source evidence is broad but not a certified census of every historical/secret prototype; no exhaustive claim published.

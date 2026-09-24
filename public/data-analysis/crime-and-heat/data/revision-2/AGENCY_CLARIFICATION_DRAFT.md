# Draft only — not sent

Subject: Clarification of arrest-record exports, coverage and field definitions

To the records custodian / Crime Analysis Unit:

We are reviewing the following workbooks supplied for an analysis of daily recorded arrest activity and weather:

- `Arrests_Jul_2018-Dec_2023_for_Release.xlsx` (worksheet: Arrests & Citations)
- `Arrests_2024_for_Release.xlsx` (worksheet: Sheet1)
- `Arrests_2025_for_Release.xlsx` (worksheet: NetRMS Arrests 2025)

The downloaded CSVs contain 172,424, 28,279 and 14,042 rows, respectively. We have preserved those files. Before making claims about agency coverage, timing or completeness, could you provide the original request/response reference and clarify the following?

1. **Provenance and coverage.** Did your agency produce these exact workbooks? When were they extracted, from which system(s), and using which inclusion rules? Does `Agency=SHERIFF` identify the arresting agency, report owner, jurisdiction, or another field? The older workbook has no Agency column. Do the files include any municipal-police arrests, jail bookings by other agencies, citations, juvenile records, court/remand events, sealed/excluded records, or cases still under review?

2. **Row and identifier meanings.** What does one exported row represent? Both the older workbook and 2024 use `Incident Number`; 2025 uses `Arrest Ref Nbr`. Can one identifier contain multiple arrestees, arrests on different dates, or supplemental reports? What is the documented relationship between those fields, and is there a stable anonymized arrest/person key or crosswalk? Can visually identical rows represent distinct events suppressed by the export?

3. **Dates and location.** What does `Incident Date_Time` mean in the older file, and is it equivalent to 2024–2025 `Arrest Date/Time`? Are timestamps local America/Los_Angeles time with daylight-saving changes, UTC, or another convention? Do `City`, `Zip Code`, and block/street fields refer to the offense, arrest, residence, booking, reporting station, or another location? How should `City=SHERIFF` be interpreted? Can the actual offense date/time and location be provided separately in a deidentified extract?

4. **Completeness and changes.** Please provide monthly control totals from the same extraction for July 2018–December 2025 and explain any reporting or system transitions. January–May 2025 contains only 213 charge rows and 144 monthly source-ID appearances; does this reflect a partial extract, migration, backfill, filter, or another issue? Is a corrected complete 2025 file available, along with records from January 2026 through the original request's intended end date? Were the same extraction methods used in every year?

5. **Official-report reconciliation.** Your July 2023, January 2024 and October 2024 Law Enforcement Activity reports describe exclusions for detention/court/non-Sheriff areas, PC 849.5 detentions and reports under review. What exact unit and filters produce those monthly arrest totals, and how should those totals be reconciled with these exports? We do not want to treat a count of charge rows or incident identifiers as the same measure without confirmation.

6. **Domestic violence and warrants.** Is a case-level domestic-violence indicator or victim–suspect relationship field available? How should warrant co-charges be interpreted when subtype is ADULT? Can same-day offense arrests be distinguished from delayed arrests/warrant service, and are there documented code or definition changes over the period?

A field dictionary, extraction specification and monthly reconciliation would be particularly helpful. We are seeking definitions and deidentified control totals; no names, birth dates or other identifying information are needed for this clarification.

Thank you.

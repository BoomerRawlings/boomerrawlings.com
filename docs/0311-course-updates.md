# Updating course options

From the repository root:

```sh
node scripts/refresh-roomie-courses.mjs ECON100A ECON120A MGT162
```

The importer reads UCSD's public Class Planner catalog, exact-matches course codes, and writes `src/data/roomie-course-options.json`. It preserves other imported courses and writes only after every requested course succeeds. Codes accept shorthand or quoted spaces, such as `PHIL10` or `"PHIL 10"`.

Add the canonical codes to the requested profile's `courseCodes` in `roomieProfiles`, inside `src/data/roomie-booking.ts`:

```ts
courseCodes: ['ECON-100A', 'ECON-120A', 'MGT-162']
```

Import before assigning a code; missing catalog data fails the build. Existing selected courses retain their selected-section behavior. Refreshing catalog data does not assign courses to profiles or book classes.

## Verified metadata

`src/data/roomie-course-metadata.json` stores the term, TSS academic year/period, and per-course overrides. Add a course entry when providing a verified `moduleId`, category/style, or meeting details. With no module ID, booking and course URLs remain null.

- Obtain module IDs from observed official TSS/Planner links. Never infer opaque IDs from course numbers.
- Record authoritative URL, observation date, and what was verified in `sources` alongside each enrichment. Keep credentials, session tokens and personal records out of this file.
- Key `sections` by exact section ID, including the `E`/`EL` prefix and leading zeroes. Section-level `location`, `startDate`, and `endDate` apply only to class meetings.
- Override exam rooms through `sections[id].meetings[key]`. Keys use `kind|day|date|start|end`; e.g. `final|S|2027-03-13|8:00am|10:59am`. The exported `meetingKey` helper constructs keys from raw catalog meetings.
- Rerun the importer after metadata changes. Changing terms requires an explicit data migration; the importer refuses to merge different terms.

## Data limits and checks

Public data includes section/package associations, instructor lists, weekly days/times, dated exams and seat counts. It currently omits module IDs, rooms and recurring start/end dates. Missing values stay unknown. Seat counts are snapshots; verify availability and eligibility in TSS.

Complete options must contain each instruction type participating in the catalog's package mappings. Incomplete lecture/discussion package IDs are excluded; unmapped sections remain visible as unassigned, which does not mean optional. Exact matching keeps variants such as `MGT-162R` separate. No authentication, booking API, credentials or runtime backend is required.

```sh
node --test scripts/test-roomie-courses.mjs
npm test
```

Review the requested profile on `/0311/`, including all section choices, unknown details and TSS links, before the normal site publication workflow.

# Project state

- Mode: new task in existing project
- Objective: publish a compact, by-link `/swc/` student-worker handoff page on boomerrawlings.com
- Status: complete and live at `https://boomerrawlings.com/swc/`
- Preserved paused work: Aristotter is present on `main`; prior local-only Pip/global-style changes mentioned by the old state were not present in this clean clone and were not touched

## Completed

- Added a standalone, no-JavaScript `/swc/` page with anchor-style section tabs so page content remains available to Ctrl+F.
- Added concise start, workflow, download, final-handoff, and official-resource sections.
- Added Markdown templates for weekly status, project handoff, and accessibility preflight.
- Used official SWC burgundy/gold and a clear unofficial-resource label; no college logo was copied or recreated.
- Kept the route unlisted/noindex and excluded it from the sitemap; this is obscurity, not access control.
- Added a page-specific 1200×630 social preview with no official logo.

## Decisions

- Keep the page public-safe: never publish credentials, student/personnel records, payroll data, private contact information, or unreleased materials.
- Keep department-specific task intake, storage, and escalation details as explicit follow-up items until verified values are supplied.
- Preserve Astro/GitHub Pages architecture and the single verified production push flow.

## Next

1. Replace the three department-specific follow-up items when verified task-intake, storage, and escalation details are supplied.
2. Add an official SWC logo only if an approved asset and permission are provided.

## Verified

- `npm test` passes on 2026-09-01: Astro build, 22 public pages, 2 unlisted pages, 4 redirects, sitemap exclusions, local links, downloads, privacy metadata, and Little Workshop contracts.
- `git diff --check` passes.
- Local `/swc/` responds HTTP 200 and contains the page title and download links.
- Social preview visually checked; required text is correct and the image is 1200×630.
- Focus and text contrast reviewed; gold remains decorative or on dark burgundy, while light-surface text/focus indicators use accessible burgundy.
- Commit `0ef43b7` passed the GitHub Pages workflow and deployed successfully on 2026-09-01.
- Live `/swc/`, all three template downloads, and the social preview respond HTTP 200; `/swc` redirects to `/swc/` and renders the expected title, workflow navigation, and unofficial label.

## Risks

- By-link plus `noindex` is not authentication.
- SWC logo/brand assets require institutional authorization; use only approved source files if added later.

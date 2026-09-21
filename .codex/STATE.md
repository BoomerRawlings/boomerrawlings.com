# Project state

## SWC Restorative Justice application

- Mode: new task. Objective: publish the user-supplied Restorative Justice application on `/swc/`.
- Status: verified, ready for one production push; fresh checkout of canonical production `aa1d3c6`. Preserve unrelated paused work below.
- Reviewed both scanned pages: Southwestern College application and course registration for Richard J. Donovan Correctional Facility; identity fields blank. Source kept byte-identical, including its preselected educational goal.
- Decision: reuse the document preview/download component; insert before Transcript Envelope Labels so existing relative order and labels-last placement remain intact.
- Source SHA-256: `0b851e501f4a10376769b89b3cc6d08b2940e93ff54193f6b7a5c44c21203c40`.
- Verification: `npm test`, diff check, and independent source review pass. Both 773x1000 previews visually reviewed. Browser opens the correct two-page dialog, loads both images, and closes with Escape; download points to the source-identical PDF. Browser screenshot capture unavailable.
- Next: publish once through main/GitHub Pages and verify live page and asset hashes.

## SWC Cares and waitlist contacts

- Mode: continuation. Objective: group requested staff under SWC Cares and add the supplied EMT/Fire Science waitlist connection.
- Status: published as `73b20a3` on 2026-09-15; Pages run `35029769224` succeeded. Reuses existing contact renderer; official directory confirms supplied new contact details and email-form URL. User-specified program connection retained; no guessed email address.
- `npm test`, diff check and independent source audit pass. Desktop 1280px shows three Cares cards in one row; mobile 390/320px stacks them, with no overflow/page errors. Priority contacts remain first; other content and original documents unchanged.
- Live `/swc/` returned HTTP 200; requested group membership, new waitlist designation, phone, office and email-form destination verified. CDN email obfuscation transforms existing HTML, so byte-for-byte page comparison is not applicable. Next: no remaining work for this update.

## SWC getting started and document order

- Mode: continuation. Objective: add eight ordered enrollment steps at the top of `/swc/`, four Canvas/Outlook mobile QR links, and the requested document-card order; publish through existing GitHub Pages.
- Status: published as `52828cb` on 2026-09-15; Pages run `35028886339` succeeded.
- Documents: Combo, Launch Check, Resources, external Canva Technology Packet, Sign-In, Loaner Laptop Agreement, AODS, New Hire, Transcript Envelope Labels. All eight original PDFs and previews unchanged.
- Verified destinations: official SWC application page uses HTTPS CCCApply; app stores identify Canvas by Instructure (student app) and Microsoft Outlook. Parchment source-school selector orders incoming transcripts; no outgoing-SWC storefront substitution.
- Copy: placement questions and prerequisites for higher-level classes, not tests; orientation information and portal both linked. Getting started precedes documents; course search remains in opening header. Existing contacts, maps, chair tables, and noindex protections preserved.
- QR assets: local black/white SVGs, medium error correction and four-module quiet zones; no new client scripts or production dependencies.
- Verification: `npm test` and independent source audit pass. All four SVGs independently decoded to exact store URLs. Desktop 1280px and mobile 390/320px checks pass: no horizontal overflow/page errors, correct step/card order, loaded QR images, keyboard PDF open/close and section navigation. Original PDFs/previews untouched.
- Live verification: `/swc/` returned HTTP 200 with the requested nine-card order, eight PDF downloads, placement-question wording and noindex protections. All four published QR assets returned HTTP 200 and matched local SHA-256 hashes.
- Next: no remaining work for this update; preserve paused objectives below.

## CBS8 OSINT4ALL resources

- Mode: continuation. User requests a sortable five-column directory (ID#, Resource, Original section, Grade, Purpose), plain-language purposes for every resource, and external evidence for rating context.
- Status: published as `a299416` on 2026-09-15; Pages run `35035902628` succeeded. Scoped release reconciled with production `d330820`, preserving newer SWC changes. Original mixed worktree and paused tasks preserved.
- Added resource links on `/cbs8/`, searchable `/cbs8/osint/`, and original workbook download in public/cbs8. Audit markup/data in src/data/cbs8/osint.html with a minimal Astro route. Existing audio table and live progress script unchanged.
- Original dataset fields, ratings, provenance and caveats preserved; workbook byte-identical and labeled as the original audit. All 1,172 purpose notes in src/data/cbs8/purposes-{1,2,3}.json; 71 entries have additional citations across 64 distinct primary/regulatory URLs. Purpose descriptions based on metadata are distinguished from externally documented functions; opaque functions remain explicitly unverified. This is not an end-to-end test or independent accuracy benchmark of every service.
- Five sortable columns; purpose stays visible, evidence and limits expand beneath it. Native same-origin JS reuses rendered rows to retain disclosure state and reduce sorting cost. Numeric ID, natural text, and explicit grade order support both directions. Search includes purposes; shortcut states visible with aria-pressed; exact row permalinks open the matching evidence. No automatic third-party requests, added dependencies, or site-wide changes. CSP allows only same-origin scripts; noindex/no-referrer and workbook fallback retained.
- Verified: npm test (22 public pages, 5 unlisted pages, 4 redirects), diff check, independent content/scope review, full purpose coverage, original-field fidelity, reference schema and source-identical workbook checks. Production-preview browser tests at 1280px/390px cover all five sorts in both directions, keyboard sorting, search/filter/reset/empty states, persistent expanded evidence, source-only filter, safe download/back navigation, no overflow/page errors or automatic external requests, and no-JavaScript fallback. Preview port4323; local development port4322. Test artifacts remain in output/cbs8-osint-check, not release scope.
- Final polish: compact coverage strip, one optional grading/provenance disclosure, calmer controls, full-width mobile search and 44px mobile targets. No added motion or dependencies; primary purpose text stays visible. Independent release review found no blockers.
- Live integrity: data and client script match release; original workbook SHA-256 unchanged; noindex and sitemap exclusion retained. Full browser suite passes at 1280px/390px; exact row permalinks and 320px layout verified. CDN-injected analytics is blocked by this page's CSP, not allowed as an external dependency.
- Next: no remaining implementation work. Preserve output test files locally and unrelated paused work.

## SWC transcript envelope labels

- Mode: continuation. Objective: move Transcript Envelope Labels to the end of the `/swc/` preview/download list and publish.
- Status: published as `599da29` on 2026-09-15; Pages run `35027409762` succeeded.
- Supplied one-page blank label grid reviewed; no recipient/student data or active PDF content. Source PDF preserved byte-for-byte; matching preview uses the existing document component.
- Existing course search, other PDFs, contacts, chair tables, maps, and noindex protections unchanged.
- Verified: previous release preserved the source/public/live PDF SHA-256; this reorder changes no PDF or preview asset.
- `npm test` and `git diff --check` pass; live page returned HTTP 200 with labels last among all eight previews and downloads. Other seven retain prior order; assets unchanged.
- Next: no remaining work for this update; preserve other objectives below.

## SWC course search

- Mode: continuation. Objective: add the official Course & Course Section Search near the beginning of `/swc/` and publish.
- Status: published as `ca7884a` on 2026-09-15; Pages run `35026122281` succeeded.
- Prominent header link opens SWC Self-Service search in a new tab; lower official-resource label matches. Existing documents, contacts, chair tables, maps, and noindex protections unchanged.
- Decision: link directly to the official search rather than duplicate its catalog or registration interface.
- Verified: `npm test` and `git diff --check` pass; live page returned HTTP 200 with the safe search link in the opening header, all seven PDF previews, and noindex protections.
- Next: no remaining work for this update; preserve other paused objectives below.

## SWC chair tables and campus maps

- Mode: continuation. User authorized publishing both reviewed additions to `/swc/`.
- Native collapsed chair section: 26 council entries, 27 departmental entries in 12 school groups, printed leadership headings, clickable emails/extensions. Typed source data in src/data/swcChairs.ts; conflicting printed details preserved, handwriting notes kept separate. No chair scans in public assets.
- Native collapsed maps section: five locations, nine complete locally rendered official map pages, original PDF and directions links. All map previews reviewed; no private media or new client scripts/dependencies. Existing seven document resources and priority contacts unchanged.
- Release isolated from mixed local work, based on production `9b8836d`; newer CBS8 code retained. Local desktop/mobile checks passed, including row counts, image loads, keyboard collapse and no page-wide horizontal overflow.
- Status: approved release prepared for final verification, main-branch push and live check. Original mixed worktree still predates production; preserve its paused Pyotter/media work and reconcile before future publishing.

## SWC contact update

- Mode: continuation. User authorized publication of the revised SWC contacts only.
- Replaced the retired contact with the two requested RJ staff cards, including verified official roles, emails, phones and office locations. They occupy the first row, followed by a subtle divider; mobile stacks in order.
- Documents, Canva link, service desks, official resources and noindex protections unchanged. Existing renderer/CSS reused; no new dependencies.
- Isolated release based on latest production commit `ca64938`, preserving newer CBS8 updates and excluding unrelated local Pyotter/media work. npm ci, npm test and diff checks pass; independent source audit clean. Regression checks cover contact details, order and divider.
- Status: published as `9b8836d`; Pages run `34636248341` succeeded and the live contact update was verified.

## CBS8 attachment table

- Mode: new task. Objective: publish /cbs8/ with sortable public audio table, source link, CSV download and live scan progress; preserve paused unrelated work.
- Implemented isolated from mixed local changes. Existing GitHub Pages workflow retained. Route unlisted/noindex, no shared chrome per explicit minimal brief.
- Live public metadata feed on cbs8-data branch under public/cbs8. Immutable timestamped snapshots avoid mutable raw-file CDN caching; client polls every10s and falls back to final progress.json. No credentials shipped. Runtime scanner and publisher run locally in the originating task.
- Browser verified sorting, CSV contents, mobile overflow and real progress advance without reload (452 to457); no page errors. npm test passed22 public/4 unlisted/4 redirects.
- Status: initial page published in e0d813f; Pages run34410855660 succeeded; production browser verified progress512→517, sorting and CSV. Full scan continues.
- Date update: Request date and Uploaded columns added to live feed, table and CSV; ISO calendar dates preserve portal dates. All35 rows populated. These are not asserted as incident/call dates. Local browser verified both date sorts, CSV values and dates retained after a live update; npm test passed. Date update ready to publish.

- Mode: continuation
- Objective: maintain the public portfolio and unlisted SWC handoff hub while shipping the approved portfolio and Little Workshop updates.
- Status: SWC source-fidelity corrections and the approved portfolio/workshop batch are live from commit `a160957`.
- Preserve: source-faithful SWC documents, no student data, no credentials or machine-specific runtime state, and the existing `noindex` treatment for link-only material.

## Completed

- Published the compact `/swc/` student-worker handoff hub with tabs, searchable headings, verified contacts, and source-needed labeling where originals are unavailable.
- Rebuilt seven YARD workbooks and six PDFs from supplied originals while removing student rows and blank scan pages without rewriting the forms.
- Replaced Little Workshop’s layered puppets with complete 32-frame character atlases, one 60 Hz scheduler, exclusive speech/idle ownership, and mobile-safe audio recovery.
- Added full-sheet character extraction, normalized alpha/material palettes, deterministic 20-second motion timelines, and frame-level verification.
- Added the Buy Me a Coffee widget across public pages, a native fallback, footer clearance, and a short first-person invitation on About.
- Added a compact Personal Search Router entry with its public Firefox Add-ons listing and GitHub source link; it remains outside the full-project count.

## Decisions

- SWC source fidelity wins over redesign; never invent a replacement when a verified original is missing.
- Keep external SWC resources labeled by their current verified role and preserve existing Drive permissions.
- Character states must be complete fixed-canvas drawings; never simulate articulation with cropped layers, translucent anatomy, crossfades, or independent transforms.
- The current 50 idles are unique authored timelines over the approved 32-frame vocabulary, not 50 wholly separate illustration sets.
- The user approved the complete verified workspace for one production push on 2026-09-01.

## Verified

- Six SWC PDFs match supplied source content and renders; 58 workbook sheets match source structure and contain no student data or hidden residual strings.
- The corrected SWC release passed GitHub Pages and its current downloads returned HTTP 200 with matching local hashes.
- Before remote integration, `npm test`, `git diff --check`, and the staged credential/path scan passed on 2026-09-01.
- Workshop verification covers two 3072 × 2048 atlases, exact frame order and bounds, 50 × 20-second timelines per character, 448 dialogue beats, and mobile audio recovery.
- Desktop and 390 × 844 checks found no horizontal overflow, covered footer controls, or Personal Search Router layout issues.
- Mozilla Add-ons API verified Personal Search Router 1.0.1 as public.
- Post-rebase `npm test` and `git diff --check` pass with both the SWC hub and portfolio/workshop updates on 2026-09-01.
- GitHub Pages run `33592406313` completed successfully; live About and Projects returned HTTP 200 with the support widget, invitation, Personal Search Router blurb, and both public links.

## Next

1. Run the remaining physical-iPhone audio check when convenient.

## Risks

- Link-only plus `noindex` is obscurity, not authentication; restricted Drive content still depends on Drive permissions.
- The Event Sign-In download remains unavailable until a verified original is supplied.
- Real iPhone silent-switch and background audio behavior still needs a physical-device check.
- More distinct physical loops require more approved drawings than the current 32-frame vocabulary.

- CBS8 transcript follow-up: separate transcript count/bar added; updates independently from request audit through existing live feed. Runtime publisher remains active until both jobs complete. Only progress counts added publicly. Build checks passed.

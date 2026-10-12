# Atlas of Contested Futures

Public route: https://boomerrawlings.com/ACF/ (the directory route also accepts `/ACF` on GitHub Pages).

The ATLAS riddle is a playful entrance, never access control. Everything shipped under `public/ACF` is public. No full articles, account data or private research notes are included.

## Counts and provenance

The 2026-10-12 snapshot contains 33,945 exported catalog records and 7,361 catalog-local name labels. Their sum, 41,306, is a count of addressable record/name entries, not globally disambiguated entities. There are 43,213 credit rows, 17,348 item-relationship rows and 1,447 affiliation assertions. These are separate table counts; their sum is not a verified unique-edge count. Among item relationships, 130 are explicitly tentative or inferred. The combined original source-assertion total is not established by these exports. IEET alone reconciled 10,488 source assertions into 10,467 records.

IDs remain namespaced. Names, editions and manifestations are not merged across collections. Literal credit roles remain visible, including publishing accounts. Related catalogs are independently collected and do not imply IEET affiliation. Record detail preserves dates, precision, source URLs, role assertions, directional relationships and their stated basis. `public/ACF/coverage.json` describes coverage gaps per catalog.

## Scale and interaction

The initial request loads IEET only (10,467 records). Collections can load all nine catalogs together. A proportional type-distribution strip counts every loaded record, including records outside the current search. Search, type/year filters and paginated reading-room access operate on every loaded record.

The Canvas map uses a deterministic representative sample of at most 480 record/name nodes, with 250 initially rendered and more revealed while zooming. Zoom changes detail within the sample; search and scope changes rebuild it. The displayed count identifies the sample. Source credits and recorded relationships use solid lines; optional title-keyword themes and explicitly tentative relationships use dashed lines. Group counts count records credited to that source label, not independent affiliations. Sampling never removes records from the reading room.

At rest, collision-aware labels show representative publication titles with type/collection metadata and credited names with record counts. Labels are clickable. Hover opens a readable metadata card; moving into the card retains it. A click or touch tap pins the card. Focus the canvas and use arrows or Previous/Next to preview nodes, Enter to pin, Shift+arrows to pan, and Escape to dismiss. Open record/credited records follows the existing source detail path. Zoom, pan, filtering, resize, view changes and exit dismiss stale previews. Cards remain within the map bounds and scroll on short screens. Names remain unresolved source labels; inferred themes are explicitly identified.

The map adds three faint decorative depth layers (66 points) that respond only to zoom/pan. They are not records, relationships or population measurements and never enter counts or hit testing. Selected actual relationships and newly filtered/theme views receive a nondirectional, simultaneous brightness emphasis lasting at most780ms, bounded to72 existing edges. Solid/documented and dashed/inferred styles remain distinct. Reduced-motion and paused views retain static selected connections. There is no ambient animation loop.

Canvas rendering stops at idle, on exit, when hidden, and for reduced-motion settling. Phones have separate map/list views, horizontal controls and readable detail panels. The accessible list is the complete alternative to the canvas.

## Updating and importing

The HTML entrance-script/stylesheet/module URLs and changed preview module imports share a release query version. Bump them together when these assets change, so a returning visitor cannot mix cached scripts/styles with new markup. The production-shell test checks this boundary.

`node scripts/build-acf-catalogs.mjs --source-root <completed-collection-root> --output public/ACF/data` regenerates allowlisted public metadata. It reads finished collectors without editing them. Review regenerated public files before committing. The nine output bundles reproduce deterministically.

The browser accepts the schema in `/ACF/import-format.json`, compatible catalog objects, and item-only JSON/JSONL. Imports are validated, namespaced and held in memory; there is no upload or persistence. Limits: 40 MB per file, 60,000 items per import, 120,000 total session records. Titles, URLs and source evidence are required according to the format; supported unknown source titles remain explicitly untitled. Malformed references reject clearly. Free-text notes, abstracts, contact fields and credentials are discarded; unsafe/local/credential-bearing links are rejected. Imported claims are supplied by the importer, not independently verified.

## Validation

`npm run test:acf` checks the public projection and foreign keys, URL boundaries, all nine imports, real-data filters, unknown titles, tentative-relationship classification, entry/reveal lifecycle, bounded rendering, idle title labels, label collision/selection, preview metadata and bounds, hover/card retention, keyboard announcements, pinned touch selection, zoom hit detection, pointer drag and two-touch pinch, reduced motion and cleanup. The existing `npm test` chain includes ACF after every pre-existing check.

Local browser QA used the desktop in-app browser at 1280×720, 768×1024, 390×844 and 320×700. Checked wrong/mixed-case answer, hint, reveal/skip, repeat entry, keyboard map selection, date/search/type filters, source/name navigation, browser Back, import, load-all, no horizontal overflow, and an intentionally failed catalog request followed by successful Retry. Physical phones and their CPUs/networks were not tested. Touch gestures were exercised through the actual pointer handlers in deterministic tests.

Observed local desktop measurements, without CPU/network throttling: IEET readiness approximately 196–409 ms after entry, full 33,945-record filter/layout/list update approximately 99 ms after caching sample ranks, ordinary filtered queries approximately 21–29 ms in Node, Canvas frames approximately 0.3–1.7 ms. These are development-machine observations, not universal device guarantees. Combined public JSON is about 42 MB raw / 4.88 MB gzip; IEET about 6.67 MB raw / 0.96 MB gzip. Host compression and network affect transfer time.

Windows checkout paths containing spaces expose an existing unrelated test's `URL.pathname` issue. Validation used a normal physical-path Astro build, then the exact remaining test chain through a temporary no-space junction with `--preserve-symlinks-main`. No unrelated production code changed. GitHub's Linux workflow runs the normal `npm test` command.

## Calm entrance and bounded spatial emphasis — 2026-10-12

The entrance contains the title, original riddle and answer form, with hint/error feedback and public-access note. ATLAS remains case/whitespace tolerant. One220ms prompt-opacity fade replaces13 animations involving3D letters, clipping and a200vmax shadow wave. Skip, interruption, repeat entry and reduced-motion completion remain available. Catalog loading begins only after the fade ends; it did not overlap the old transition either. The initial app path now indexes once and prepares the graph once through readLocation; later collection changes retain their refresh. Cached reentry from List keeps the hidden graph inactive. Reentry focus can scroll the answer field into short viewports.

An immutable a69dc4f baseline and the final working tree were served locally with the same external, unshipped measurement probe. Three fresh-entry runs per version at1280×720 and390×844: median entrance time2630.7→225.5ms desktop and2627.9→230.4ms phone viewport. Initial graph preparation was verified2→1 by the actual entry/app/catalog integration loop. Post-entry long tasks remained97–104ms in final runs (baseline129–211ms); startup is not stall-free. One cached desktop reentry per version made no new data request and recorded no long task.

The baseline did not reproduce entrance RAF gaps over50ms on this machine. Removing clip/shadow/3D work proves a structural rendering reduction, not improved presented FPS on the reporting device. RAF callback cadence is not GPU/compositor presentation. CPU/network throttling was unavailable in the supported browser API; phone viewports are desktop emulation, not physical phones. Integration tests use controlled immediate/800ms fetch delays solely to test sequencing, not to claim slow-device performance.

Two theme-toggle runs per viewport/version used a1800ms observation window. Final Canvas draw medians1.4–1.6ms, p952.6–3.3ms, max3.4ms;80–81 draws then idle. Baseline medians1.3–1.5ms, p952.6–3.2ms, max6.1ms;67–72 draws. The new bounded effect adds work (~129–137ms total draw CPU versus103–118ms); it is not an FPS optimization. No final theme-toggle long tasks were observed. Tests cover actual-edge membership/classification, replacement on filtering, static reduced/paused selection, idle queue cleanup, visibility/exit/destruction and decorative exclusion from counts/hits. Browser checks cover zoom, keyboard selection, phone previews, hints/errors, repeated List/Map entry and320×300 focus visibility. Existing data, source semantics and all other routes remain unchanged.

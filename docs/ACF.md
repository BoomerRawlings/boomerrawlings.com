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

Local browser QA used the desktop in-app browser at 1280×720, 768×1024, 390×844 and 320×700. Checked wrong/mixed-case answer, letter reveal/skip, repeat entry, keyboard map selection, date/search/type filters, source/name navigation, browser Back, import, load-all, no horizontal overflow, and an intentionally failed catalog request followed by successful Retry. Physical phones and their CPUs/networks were not tested. Touch gestures were exercised through the actual pointer handlers in deterministic tests.

Observed local desktop measurements, without CPU/network throttling: IEET readiness approximately 196–409 ms after entry, full 33,945-record filter/layout/list update approximately 99 ms after caching sample ranks, ordinary filtered queries approximately 21–29 ms in Node, Canvas frames approximately 0.3–1.7 ms. These are development-machine observations, not universal device guarantees. Combined public JSON is about 42 MB raw / 4.88 MB gzip; IEET about 6.67 MB raw / 0.96 MB gzip. Host compression and network affect transfer time.

Windows checkout paths containing spaces expose an existing unrelated test's `URL.pathname` issue. Validation used a normal physical-path Astro build, then the exact remaining test chain through a temporary no-space junction with `--preserve-symlinks-main`. No unrelated production code changed. GitHub's Linux workflow runs the normal `npm test` command.

## Letter entrance and bounded spatial emphasis — 2026-10-12

The calm entrance contains the title, original riddle, answer form and back link. Its separate hint and public-information note are removed; provenance/public-data explanations remain inside the explorer. ATLAS accepts case/whitespace variation and wrong-answer feedback remains accessible.

LEO's existing initial-letter rearrangement informed the intro. Atlas uses five copper letters that rise, spread, grow, settle into ATLAS, then lift/fade before the explorer opens. Five1440ms letter animations are staggered60ms (1680ms total), alongside one180ms prompt fade. Only transforms/opacity animate; there are no waves, shadows, clipping, layout animation, extra timers or continuous entrance loops. The timeline is linear, with easing on individual moving segments: this preserves a307ms common settled hold. Applying easing to the entire timeline compressed that hold and was rejected by both rendered evidence and regression checks.

All six animation promises are awaited before hiding the gate or starting catalog work. Skip, resize/visibility interruption, repeat entry and reduced-motion/no-animation-API completion cancel/reset cleanly. Reduced motion enters immediately with no letter transforms. Reentry focus can scroll the answer into short viewports. The existing one-preparation startup path and inactive cached List reentry remain intact.

The real entry/app/model integration suite verifies visible letter targets, changing transforms, settled hold, final-letter completion, interruptions, repeated entry, source-data load ordering, one initial graph preparation and cached List/Map behavior. Intentional premature-reveal, early-load and global-easing mutations fail their respective guards. These deterministic tests do not measure physical animation smoothness. Local browser probes separately capture real computed transforms, opacity, bounds and screenshots across rising/settled/departing states, using actual normal motion preference at desktop/phone viewports. Probes are unshipped and do not pause or alter the animations.

The graph's bounded780ms relationship emphasis and three decorative depth layers are unchanged. The previous main-view comparison measured p95Canvas2.6–3.3ms (max3.4ms),80–81 draws then idle; this adds bounded work, not an FPS optimization. Decorative points remain outside record counts/hits, and actual/inferred relationships stay visibly distinct.

Physical phones and GPU-presented FPS remain unverified; the supported browser exposes viewport controls but no CPU/network throttling or reduced-motion emulation. Normal preference is checked in the rendered browser; reduced-motion behavior is tested through the real script's media-query branch in the deterministic harness. Controlled800ms fetch delays test ordering only. Initial catalog indexing can still produce a brief startup long task after the intro.

Final unthrottled browser observations: two1280×720 and two390×844 runs completed in1685–1688ms. All five letters had distinct visible positions and sizes, were fully opaque/settled near951ms, and their actual finished promises resolved before entry. Observed entrance RAF max gaps12.4–15.1ms, none over34ms; these are callback timings, not presented GPU FPS. Diagnostic geometry reads every100ms add some observation work. Full52-command site suite,42ACFtest groups and33entrance cases pass.

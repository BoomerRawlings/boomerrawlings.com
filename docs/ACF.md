# Atlas of Contested Futures

Public route: https://boomerrawlings.com/ACF/ (`/ACF` also resolves on GitHub Pages).

Atlas explores public bibliographic metadata. Its riddle is a playful entrance, never access control. Everything shipped under `public/ACF` is public; full articles, private research notes and account data are excluded. Related catalogs were collected independently and do not imply IEET affiliation.

## Snapshot and provenance

The 2026-10-12 snapshot contains all nine exported collections:

| Collection | Records | Catalog-local name labels |
| --- | ---: | ---: |
| IEET | 10,467 | 897 |
| Transhumanity | 2,584 | 798 |
| Technophany | 577 | 240 |
| Journal of Posthuman Studies | 192 | 162 |
| Journal of Futures Studies | 1,988 | 1,444 |
| Institute of Network Cultures | 4,702 | 2,088 |
| AFT–Technoprog | 2,026 | 362 |
| Biopolitical Times | 2,725 | 836 |
| Center for a Stateless Society | 8,684 | 534 |
| **Total** | **33,945** | **7,361** |

The 41,306 record/name entries are not globally disambiguated entities. IDs remain namespaced; names, editions and manifestations are not merged across collections. Labels may identify people, groups or public publishing accounts. Literal credit roles remain visible.

The exports retain 43,213 credit rows, 17,348 item-relationship rows and 1,447 affiliation assertions. These are separate table counts, not a verified unique-edge total. Of the item relationships, 130 are explicitly tentative or inferred. Affiliation assertions retain their source and temporal qualification; they do not become invented map connections. Dates, precision, unknown titles/bylines, source URLs, relationship direction and stated basis remain available in record/name details.

The combined original source-assertion total is not established. IEET alone reconciled 10,488 source assertions into 10,467 records, including 504 publication-view records and 199 events/talks. `public/ACF/coverage.json` and each bundle describe source-specific gaps. A complete export of the collected snapshot does not establish complete historical coverage of an organization.

## Complete map and reading room

Initial entry fetches all nine catalogs and publishes one index after every catalog arrives. The first full map contains every 33,945 record point. The optional names layer contains all 7,361 labels, including 204 without a resolved credit. Six inferred theme hubs bring the full cached graph to 41,312 nodes. Its 73,320 edge entries comprise the exported credits and item relationships plus 12,759 overlapping title-theme matches.

Record points are never sampled or progressively substituted at different zoom levels. Coordinates depend on namespaced IDs and title-theme membership; filtering, zooming or removing another collection does not reposition surviving records. Bounds remain stable. Search, type/year filters, name/theme scopes and the paginated reading room operate on every active record. The type-distribution strip counts every active collection record, including records outside the current search.

WebGL uploads every enabled point and route. Canvas 2D provides a fallback that draws points intersecting the camera viewport; camera culling does not remove records from the model. Status separates points submitted for drawing from geometrically in-view points. Neither number measures unobscured pixels: points can overlap. Names, labels, documented routes, inferred routes and regions have separate controls. Only record/name labels are reduced for readability. The initial view shows record points, six distinct soft region boundaries, and seven accessible named/count buttons; names and routes are opt-in. Region labels and picking work independently of inferred routes.

The model caches nodes, edges and adjacency once per index. Startup separates indexing, cached graph construction and final drawing setup into browser tasks, allowing interaction between stages. Returning to the riddle pauses new requests, JSON parsing, unfinished preparation and load-error display until the next completed entry. Already-requested response bodies may still arrive; they are retained without parsing or restarting the fetch. Filtering scans cached data without repeated position calculation or sorting. Layer changes reuse the prepared graph. Opening another record detail with unchanged filters avoids rebuilding or uploading the graph. Item details use a cached relationship lookup.

Hover or keyboard focus opens a metadata preview; moving into the card retains it. Click/tap pins it. Arrows traverse nearby visible nodes; Previous/Next cycles through every enabled node, including offscreen records. Enter pins, Shift+arrows pans and Escape dismisses. Search results and the detail panel's Locate action reach an individual record and center it on the map. The reading room remains the complete accessible alternative. Preview names are credited labels, not verified identities; unknown metadata is explicit.

## Themes, regions and motion

Six overlapping themes use the English title-keyword rules in `model.js`: Minds & machines, Bodies & enhancement, Power & justice, Planet & possibility, Culture & networks, and Futures & risk. Record detail shows the literal matched title text and its source URLs. Matches are heuristic and language-limited; absence of a match does not establish absence of a subject.

Theme hubs, dashed theme routes and region ellipses are inferred presentation aids. Their coordinates, proximity and overlap do not establish citation, influence, agreement, affiliation or organizational membership. Documented credit/item routes are solid; tentative item relationships and title-theme routes are dashed. Name counts measure unique credited records, not affiliations.

Region membership is cached as unique record-ID sets: Minds 1,584; Bodies 2,530; Power 2,678; Planet 662; Culture 2,605; Futures 2,700. The unique union is 11,331, leaving 22,614 records with no current title-keyword match. The overlapping membership sum (12,759) is never subtracted from the loaded total. Unmatched includes foreign-language, ambiguous and missing titles without claiming those records lack themes.

Region selection, combined facets, record detail and browser history retain the entire 33,945-point surrounding field and its original geometry buffer. A separate 135,780-byte mask highlights actual members; nonmembers remain visible. Region total, selected result count and full field count are separate. Source search and explicitly scoped name browsing keep their existing behavior. Lazy aggregates cache eight result combinations per index, not per-frame work. Literal matched words, overlapping groups, collection/type/source-year (including unknown), catalog-qualified credited names and same-credit roles combine as AND filters. Date and alphabetical sorts are explicit; there is no importance ranking or generated summary.

Region panels paginate actual records, names/roles and documented neighbor assertions with original basis/source evidence. Name pickers are prepared on expansion, show at most 80 options plus the active selection, and search every regional label; no identity merge occurs. Counts use unique selected record IDs. Unknown dates follow dated records in both chronological sorts, with source date kind/precision retained in details. Escape and close restore visible focus. On phones the exploration area scrolls vertically, retaining a usable field height below all seven region buttons. Controls fit the viewport without horizontal overflow at the tested widths of 320, 390, 768 and 1280 pixels.

Three faint decorative depth layers contain 66 points outside the record model, counts and hit testing. Selected existing routes may receive a nondirectional brightness emphasis, bounded to 72 edges and 780 ms. No ambient animation loop runs. Idle, hidden, paused and exited views stop rendering; reduced motion retains static context.

## Neutral entrance and loading sequence

Before the answer, the page/browser title is “A question of futures”; the opening heading and accessibility text do not disclose the answer. The original riddle, answer form, feedback and back link remain. There is no separate hint control or public-information blurb. The form accepts case/whitespace variation. The Atlas title appears after a correct answer; return restores the neutral title.

Five letters rise, spread and settle into ATLAS, then shrink into a decorative five-point constellation. Each letter uses a 1,440 ms transform/opacity track, staggered by 60 ms, for 1,680 ms total. A linear timeline with segment easing preserves the common settled hold. Prompt, letter, star and link animations are awaited before catalog work starts. There are no animated layout properties or timer-driven entrance loops.

The constellation then holds still while catalogs load and the full graph prepares. It is decoration, not a preview of catalog relationships. The workspace is inert during this loading phase. `acf:ready` triggers the constellation's 420 ms spread and the screen's 460 ms fade, then enables the explorer. Load failure exposes the retry interface. Skip, resize/visibility interruption, reduced motion and missing animation APIs can complete immediately; these paths do not promise a visible loading hold. Return/reentry resets motion and reuses loaded data without activating a hidden List-view map.

## Updating and importing

Regenerate the allowlisted public projection with:

```sh
node scripts/build-acf-catalogs.mjs --source-root <completed-collection-root> --output public/ACF/data
```

The adapter reads completed catalogs without modifying collectors. Its nine bundles are deterministic; review regenerated public files before committing. Source catalogs remain unchanged by the map. HTML script/stylesheet URLs and module dependencies share a release query version, currently `futures-20261012`. Bump the entry, styles, app, model, preview, graph, spatial-index and renderer dependencies together; regression checks prevent mixed cached releases.

The browser accepts `/ACF/import-format.json`, compatible catalog objects and item-only JSON/JSONL. Imports stay in memory, with no upload or persistence. Validation namespaces IDs, requires public source evidence, rejects malformed references and preserves supported literal roles/temporal assertions. Explicitly unknown source titles stay untitled. Only allowed metadata fields survive: abstracts, notes, contact and account fields are discarded. Links must pass the public HTTP(S) URL filter, which excludes local/IP destinations, embedded credentials and recognized credential query parameters. Imported provenance is supplied by the importer, not independently verified.

| Limit | Maximum |
| --- | ---: |
| Each file | 40 MiB |
| Items / names per import | 60,000 / 20,000 |
| Credits / relationships / affiliations per import | 150,000 / 100,000 / 30,000 |
| Session records, including all 33,945 public records | 120,000 |
| Imported name labels per session | 60,000 |
| Imported credit + relationship + affiliation rows per session | 500,000 |
| Imported file bytes per session | 120 MiB |

Deselected imports remain cached and selectable; they still count against every session limit. Unchecking a collection does not restore its import budget. Reload clears imported data and its budget. Public records count toward the session record limit even when deselected.

## Validation and performance

`npm run test:acf` covers projection/schema/foreign keys, URL and import boundaries, all nine catalogs, full point/ID parity, stable coordinates, exact theme evidence, graph caching, renderer layers/fallback, spatial picking, preview lifecycle and accessibility, and the real entry/app load sequence. Entrance tests check awaited motion, static loading, readiness, interruption and repeat entry; they do not measure physical frame rate. The existing `npm test` chain includes ACF after the pre-existing site checks.

Local browser measurements used Chrome 155 on Windows, DPR 1, without CPU/network throttling. The 390×844 case is a desktop browser viewport, not a physical phone. Each scripted interaction run recorded 90 draws; benchmark instrumentation is included. Values below are milliseconds at the 95th percentile. Desktop input samples combine its two layer runs.

| Viewport / backend / enabled layers | CPU draw | Input to draw | Animation callback interval |
| --- | ---: | ---: | ---: |
| 1280×800 / WebGL / records + labels | 2.6 | 12.2 | 10.2 |
| 1280×800 / WebGL / all layers | 5.2 | 12.2 | 10.3 |
| 390×844 / WebGL / records + labels | 3.2 | 11.7 | 10.3 |
| 390×844 / Canvas 2D / records + labels | 51.6 | 69.9 | 70.1 |

These measure JavaScript drawing/submission and callback cadence, not GPU completion or displayed FPS. Desktop maximum observed input-to-draw delay was 43.5 ms. Canvas fallback is substantially slower: median CPU draw 32 ms, maximum 57.5 ms; maximum input-to-draw delay 83.2 ms. The complete reading room is the alternative when graphics are slow. During the phone-viewport pan, 15,000–33,945 records intersected the camera; reset restored all 33,945. Clipping does not sample or delete records.

Startup after the entry signal, excluding letter motion and final reveal, took 1,306.4 ms on desktop WebGL, 1,575.9 ms on phone-viewport WebGL and 1,171.5 ms on phone-viewport Canvas. Task boundaries split the earlier 989 ms uninterrupted preparation into observed long tasks of 329/151/489 ms, 371/193/467 ms and 313/151/368 ms respectively. Startup remains a main-thread bottleneck; staging allows interaction between tasks rather than eliminating their cost. The normal entrance holds a still constellation during this work. A worker is not implemented. Observed used JavaScript heap was 110.0/125.9/137.3 MB respectively, including the diagnostic harness; this is not total browser/GPU memory.

A desktop follow-up after adding request/parse/error resumption guards measured 1,342.6 ms startup, long tasks of 391/161/476 ms, 360.3 ms renderer setup and 132.5 MB used heap. It retained exact record/name IDs and coordinates with no errors. Deterministic delayed-directory/body tests separately verify that new requests and parsing wait through repeated letter motion; late load errors also wait for entry. The renderer and camera timing table above are unchanged by these guards.

Actual WebGL buffers matched all 33,945 record IDs, 7,361 name IDs and six hubs, with zero coordinate mismatches. With all layers enabled, 73,320 routes were submitted. Forced context loss retained those counts in Canvas fallback, with one all-layer fallback draw taking 182.3 ms; restoring WebGL retained the same data. All three final scenarios reported no errors or pending idle frame. The local evidence summary is `full-map-performance-summary.json`.

The nine catalog bundles total 41,972,984 bytes raw (about 42 MB); a local default-gzip estimate is 4,793,086 bytes (about 4.79 MB). Actual host compression and network conditions determine transfer cost. Earlier sampled-map timings are not evidence for this renderer. Physical phones, throttled CPU/network behavior and GPU-presented FPS remain unverified.

All 52 package test commands were validated: the build and first 50 checks passed; the final ACF command passed 57/57 after correcting one obsolete test expectation for inferred-theme collection labels. Production code did not change for that retry. ACF includes 49 entrance lifecycle cases, including delayed directory/body delivery, repeated entry, late failures and retry. The original attempt and complete ACF retry logs are retained separately. All 432 source catalog/collector files and 12 public catalog/adapter files matched their prior hashes.

On Windows, a pre-existing unrelated test's `URL.pathname` handling fails for checkout paths with spaces. Validation builds from the normal physical checkout without `NODE_OPTIONS`, then runs the exact remaining test chain through a verified no-space junction with process-local `--preserve-symlinks-main`. The build must not use that flag. GitHub's Linux workflow runs the normal `npm test` command.

### Region update validation

The region update validates all 52 package commands, with 68 ACF groups including 51 entrance cases after the clarity follow-up. Its harness supports the phone-width media query used for visible focus restoration. All 432 source/collector files and 12 public catalog/adapter files remain unchanged. Actual browser evidence covers seven regions, combined facets, catalog-qualified name search, record details, back/forward, static controls, independent layers, context recovery and widths 320/390/768/1280. Reduced motion and synthetic touch handling are covered by deterministic tests; physical-device input remains unverified.

The local GPU probe observed 894 WebGL item draw calls, each with 33,945 vertices. Across 36 snapshots and 22 independently source-verified selection masks, item IDs, Float32 coordinates and base geometry buffers remain unchanged within a graphics context. Context restoration intentionally reuploads buffers. Selection updates upload a separate 135,780-byte mask, retaining the 814,680-byte item geometry buffer. Selected shader alpha at the measured overview is 0.9408 for members and 0.1596 for nonmembers; context points remain visible. This proves submission and shader parameters, not individual pixel visibility or GPU-presented FPS. The complete Canvas reading room retains all 33,945 records; inactive List views leave the last map draw counters unchanged.

The updated 90-step camera probes use Chrome 155/Windows/DPR 1 without throttling. CPU draw p95 is 3.8 ms on 1280×900 with initial regions, 3.8 ms with a selected region, and 11.4 ms with all layers. At 390×844 it is 10.6 ms initially and 9.4 ms selected. Canvas at 1280×900 is slower: 67.9/62.5 ms initially/selected. Desktop all-layer input-to-draw p95 is 16.7 ms; phone initial/selected 15.4/15.2 ms; Canvas 79.5/74.5 ms. These are slower observations than several earlier values above. Different viewport heights, baseline regions-off state and diagnostic instrumentation prevent a controlled attribution of the differences. No universal smoothness claim is made.

The 15-step region UI probe retains every item vertex and performs no base point-geometry uploads. The largest synchronous action is selecting 22,614 unmatched records (85.1 ms); its next-frame observation is 101.6 ms. Lazy unmatched facet expansion takes 21 ms to the first frame; name search 8.6 ms and credited-name expansion 24.9 ms. Observed startup enter-to-ready is 1,156.4 ms desktop, 1,081.9 ms phone viewport and 1,012.2 ms Canvas, with largest tasks of 418/315/327 ms respectively. Each is one local-server observation, not a statistical improvement over the prior 476 ms task. Startup and full Canvas drawing remain material performance limits. Local reports: `region-performance-summary.json`, `region-gpu-proof.json`, `region-suite.json` and `region-acf-retry.json`.

The final clarity follow-up labels the toggle 'Record/name labels' and shows a static Canvas fallback note directing users to List. Notice visibility changes only when the graphics backend changes, including recovery; camera frames do not rewrite or announce it. Full source tests and live release checks cover this follow-up separately from the measured renderer, whose geometry and draw code are unchanged.

Keyboard facet clearing preserves the open disclosure and panel scroll within the same region. Selecting the last facet's All option restores focus to its refreshed selector; Clear region facets restores focus to the refreshed Clear button. Switching regions resets panel scroll to the heading and Close control after rendering and does not carry the open disclosure into a different region.

## Star navigation and distant views

Selecting a star with click, tap, Enter or Space centers it at the current zoom. Dragging moves the whole field, including when starting on a selected star or a painted label; press targets and release movement are retained so fast drags do not become clicks. Mouse drags on noninteractive preview content and touch drags on its header pan the map. Touch scrolling within long preview metadata and its buttons remain independent.

Overview fits the whole field; Nearby and Close view center a selected star or the nearest actual record before changing zoom, including from empty sky. A continuous 0.4–64× slider, direct Zoom to this star, empty-view recovery and Expand map provide other ways to navigate. Expansion hides the reading room and region navigation while retaining search and the map/list switch; Restore layout returns them. Region labels use a bounded wider placement search at distant scales, with leader lines and control exclusions.

Distant stars use softer density opacity; close views reveal bright cores and colored halos in the existing GPU point pass. Every record vertex, position and independent region mask remains unchanged. No photo gallery, source-image downloads, new animation loop or per-frame geometry upload was added. Motion remains bounded and reduced/static motion is respected. Gesture, preview, empty-sky navigation and full-scale renderer tests cover this update; actual browser and live release evidence is recorded separately.

## Futuristic entrance, camera flights and connection flow

The full title is one prominent wordmark. After the answer, a 1,500ms monospaced typing sequence becomes a loose angular constellation. Collection preparation runs beneath a still opaque constellation; the prepared map and constellation then share an 820ms expansion/crossfade. Both GPU stars and the overlay receive the same transforms. Skip, reduced motion, re-entry and interrupted transitions remain usable.

Star selection pans at the current zoom over a 600ms eased flight; the preview appears on arrival. Dragging interrupts immediately from the current camera position. Nearby, Close and direct star zoom also ease to their destinations. Reduced or paused motion applies the final camera position immediately.

Show connections enables documented and inferred routes with their catalog-local name endpoints. Individual layer switches remain available; Hide connections hides routes without changing the name layer. Source credits are cyan, recorded relationships green, inferred relationships violet and title-keyword matches amber. Solid/dashed styling also separates documented/inferred evidence. Paired moving markers avoid asserting a causal direction. Category speeds are an ordinal visual cue, not calculated confidence probabilities.

Angular route geometry is cached once. The WebGL pass changes time uniforms, keeping every enabled edge and all record points. Route-only rendering is capped at 30Hz; no continuous redraw remains with routes disabled. Pause, hidden/inactive maps and reduced motion stop flow. The slower Canvas fallback keeps static routes plus a bounded 2.6s selected-route burst. Selected overlays have a small fixed marker budget. Browser proof and CPU submission measurements accompany the release; they do not establish physical-device GPU frame rates.

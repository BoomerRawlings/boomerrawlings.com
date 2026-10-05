# Project state

## Native lecture replacement — 2026-10-05

- Mode: continuation. Status: verified; publishing. Baseline9da7f56.
- Objective: complete native alternative to supplied PowerPoints, all information retained, related bullets visible together; integrated selected diagrams/animations.
- Implemented:139 native scenes,197 groups/417 text items,106 clean scientific figure crops. Full source-slide images removed from lecture payload.18 integrated demonstrations;4 controlled animated diagrams; optional full visual focus; private native presenter previews/notes/timer. Arrow/Space advances whole scenes, including reading guides.
- Preserve: encrypted memory-only collection;139-page order; no invented L6 slides. Originals/crop provenance remain private outside repository.
- Verified: all139 original pages/native frames and106 crops reviewed;18 demos pass settled pixel audit. Corrected image clipping, dense text, multi-figure sizing and comparison collapse.320/390 no horizontal overflow;1920 projector capture. No production-preview console errors.
- Interaction: modal figure enlargement/Escape, blank/restore, pointer, clicker keys, demo focus/context, retained separation verified. Native modal closes before blanking; figure src/alt cleared; pointer restored. Code review resolved all reported defects.
- Tests:13 presenter,11 mounted-demo,4 companion regressions pass; full npm test passed (exit0), final strict lecture TS and diff checks pass.
- Evidence: docs/codex/user-facing-tests/2026-10-05__user-facing-flow-test__native-lectures.md; external qa/lectures/native.
- Limits: embedded browser does not expose separate companion popup pixels/native fullscreen; companion lifecycle/content verified by production-code tests. Dense scientific labels use enlargement.
- Lock cleanup verified: source images/descriptions and native scene DOM cleared; gate restored.
- Next: single verified release, live check and state checkpoint.

## Lectures portal — 2026-10-05

- Mode: continuation. Status: complete. Release7214116 live; Pages37361157029 succeeded. Baseline9704ded.
- Objective: fourth Lectures tab, password-selected collections, labeled relationships, source-paced interactive presentation and green pointer.
- Sources: user L1–L5 PDFs (139pages), Quiroga2005/Tyree2023 papers, optional action-potential video. Originals/adaptation scripts outside repo. Only encrypted lecture payload committed.
- Implemented: gate/map/search;139lecture slides + two6-slide paper guides; reveals/overview/notes/source comparison; figure hotspots/zoom,4 schematic labs, existing atlas models with separation/orientation/picking. L6 lecture awaits source slides.
- Decisions: static Pages retained; AES-GCM/PBKDF2 password encryption, memory-only unlock. Shared password remains guessable; no account-authentication claim.
- Verified: full npm test passes; final build/strict TS +10crypto/10presenter tests pass. Source page order and raster references checked. Public ciphertext contains no lecture titles/plaintext source data.
- Visual: all151slides captured and independently reviewed; dense lab layout fixed; L5trial raster restored and demo moved to orientation slide,3recaptures pass.320/390phone controls, all4modes, search empty, keyboard pacing/Escape, source-state retention, separation/reset/compass and actual green pointer verified.
- Cleanup: lock/reload removes decrypted DOM; close/destroy releases retained map/openers. Regression covers actual close. No observed console errors. Embedded browser declines native fullscreen; explanatory window fallback works.
- Evidence: `docs/codex/user-facing-tests/2026-10-05__user-facing-flow-test__lectures.md`; external `qa/lectures`.
- Deployment: superseded documentation-run37349054217 was stalled in deployment queue; canceled it so new release could build.
- Live verified: password opens139-slide collection; interactive voltage diagram/reveal and green pointer work. CSS/app/labs/models/encrypted pack SHA-256 all match tested build. No browser console errors. Live screenshots in external `qa/lectures/live-lectures.png` and `live-presentation.png`.
- Cleanup: viewport reset; live presentation retained as deliverable.
- Next: none for supplied materials. L6 lecture requires source slides; native fullscreen unavailable in embedded test browser (window presentation works).

## Course navigation and model inspection — 2026-10-05

- Mode: continuation. Status: complete; application releaseaf3441e live and verified.
- Objective: stronger separation, dynamic orientation compass, nuanced question corrections, PSYC105/108 chapter study materials, coherent anatomical links, homepage Selected work.
- Baseline: clean303e15e; prior releasebb65a3a verified live.
- Decisions: preserve source geometry; exploded offsets explicitly illustrative. Remove organ-to-generic-axon views. Anatomical compass only for atlas/tract coordinates; generic axes for schematics. Course scope preserves review history.
- Verified: official UCSD105 Cognitive Psychology /108 Cognitive Neuroscience; Ward16 chapters, Reisberg15. Book pairing assumed105 Reisberg /108 Ward pending optional confirmation.
- Implemented: rigid region/family separation with smooth camera fit; orientation compass; no generic organ-to-axon views;31 original chapter guides,93 concepts,62 retrieval prompts;150 answer explanations/100 targeted corrections; homepage feature.
- Verified:282 separated/nested camera fits,12 orientation checks; feedback and chapter integrity; strict TypeScript. Production-preview checks confirm chapter filters, notes-only reload and keyboard retrieval.
- Final local checks: full npm test and strict TypeScript pass;50 scenes/6,500 frames/267 zoom boundaries. All60 macro views visually pass after fixing cortical overlap and bilateral tract orientation.320/390 layouts, compass rotation/snap, focused nucleus, course reload, Again/undo, and keyboard wrong-answer disclosure verified. No preview console errors.
- Evidence: `docs/codex/user-facing-tests/2026-10-05__user-facing-flow-test__course-study-and-anatomy.md`; external `qa/course-navigation`.
- Live main release: Pages37345860504 succeeded; three bundled assets and two source datasets matched local build. Homepage feature present.
- Follow-up: local standalone links bypass delayed Pip departure. Broad data-topic selectors had hidden the renderer and altered counts/card surfaces; all four operations now target library buttons.
- Follow-up verified: full npm test and strict TypeScript pass; four actual-filter regressions fail on old code and pass on fix. UI AMPA-to108Ch.2, search and persisted reload retain visible thalamus/compass without console errors.
- Live final: Pages37348851172 succeeded foraf3441e; CSS/app/lazy-renderer plus course/feedback datasets match tested build. Homepage link opens Brain; live AMPA-to108Ch.2 retains visible model,16-topic count and compass; Superior snap updates projected axes. Screenshot: external `qa/course-navigation/live-brain-guide.png`.
- Documentation-onlydfb9bc0 preserves the same site code; Pages37349054217 build passed. Preview stopped; viewport reset.
- Next: none for this request.
- Limits: no lecture schedule supplied; use actual textbook chapters, clearly label supporting models and curriculum gaps.


## Visual recognition - 2026-10-05

- Mode: continuation. Objective: make every topic visually transferable to classroom anatomy/chemistry, reducing misleading abstraction.
- Status: complete. Published `bb65a3a`; Pages run `37334892318` succeeded.
- Findings: molecular CPK colors are muted, dark bonds disappear; no conventional2D chemistry cross-reference; protein defaults show schematic gating while measured structures are secondary. Isolated anatomy and generic cell shapes weaken recognition.
- Direction: standard molecular depiction and element key, stable identifying features, atlas context/orientation, stronger cell silhouettes; preserve accurate topology and explicit reference limits.
- Ownership: macro geometry/context; micro cell/synapse morphology;50-topic recognition reference dataset; root chemistry/protein/UI integration and final verification.
- Next: implement source-backed visuals, audit model/card views, run relevant checks, one verified production release.
- Course emphasis: Cognitive Neuroscience first; Ward4e2020 and Reisberg8e2022 supplied. Actual textbook figures inspected;32 verified references across22 topics. PDFs/EPUB remain outside repository.
- Implemented: atlas cutaways/CSF landmarks and source-matched MRI tract context; distinct cell silhouettes and connected synapses;9 standard formulas + CPK elements;6 experimental ribbon structures rigidly aligned to OPM.
- Verified:9 independent RDKit graph/stereochemistry comparisons;6 rigid protein fits RMSD<.006Å;50 default model screenshots inspected, corrective recaptures underway.
- Final verification: full npm test and strict TypeScript pass;50 scenes/7,012 frames/291 zoom boundaries.50 defaults +4 macro focus +3 micro closeups +9 phone views inspected; formula/conformer cards, vertical reveal, next/undo and320px protein card pass. No production-preview console errors.
- Live: Brain/Psyc200;3 bundled asset hashes and17 reference/model assets match tested build. Browser confirms textbook-linked hippocampal context, charged acetylcholine formula/card toggle and OPM-oriented AMPA ribbons; no console errors. Screenshot: external `qa/visual-recognition/live-textbook-anatomy.png`.
- Limits: existing50-topic foundation is not complete coverage of either textbook. Cellular animations remain labeled teaching models; molecular/protein data retain source/construct/protonation limits.
- Next: none for this visual-recognition request; course curriculum gaps documented in `docs/brain-textbook-reference-map.md`.

## Structure search - 2026-10-05

- Mode: continuation. Objective: replace oversized structure dropdown with compact, usable selection.
- Status: complete. Published `7b6d4de`; Pages run `37327119191` succeeded.
- Change: disclosure search, bounded results, zoom-aware Structures/Fine details; existing semantic parent names distinguish repeated protein features. Direct3D selection retained.
- Verified: strict TypeScript and continuity suite; keyboard search/select, no-match, Escape within expanded view, repeated selection without navigation,390px layout and64-part zoom refresh retain query/focus.
- Final checks: full npm test passed;64-part lists grouped and searchable by domain;320/390 layouts fit; Home/End, single list tab stop, clean Tab exit and outside dismissal work. No console errors.
- Live: release/data hashes match tested build; old select absent, search filters correctly, Enter focuses anatomy and restores trigger focus; no console errors. Screenshot: external `qa/anatomical-accuracy/live-structure-search.png`.
- Next: none.

## Vertical flashcard flip - 2026-10-05

- Mode: continuation. User requests calmer top-to-bottom card flipping.
- Status: complete. Published `18ade63`; Pages run `37324952025` succeeded.
- Change: rotate all card faces on X axis; gentler easing/perspective; clip transient perspective overflow. Reduced-motion behavior retained.
- Verified: full npm test; desktop and390px phone reveal/return motion, Space shortcut, no horizontal overflow or console errors.
- Live: release hashes match tested build; X-axis motion and softer easing confirmed in production, no horizontal overflow or console errors. Screenshot: external `qa/anatomical-accuracy/live-vertical-flip.png`.
- Next: none.

## Anatomical accuracy — 2026-10-05

- Mode: continuation. Objective: anatomically appropriate geometry and connections across all atlas topics and Practice.
- Status: complete. Published `691893f`; Pages run `37323403732` succeeded.
- Implemented:108 source-derived regional surfaces replace generic macro node diagrams; corrected cellular morphology, cortical layers, synapse topology, channel architectures, myelin/nodes and membrane receptor trafficking. Topic-specific reusable WebGL cards replace eight generic sketches; experimental protein structures preferred where available.
- Decisions: preserve source coordinates and species/construct limits; keep incompatible atlas/tractography templates separate; no invented nuclear boundaries or continuous axons across relay synapses. Existing study progress and scheduling preserved.
- Verified: full npm test, strict TypeScript and diff checks pass. Coverage includes108 regional surfaces,36 micro scenes,6,244 animation/detail frames,255 zoom boundaries and15 selected-structure framing cases.
- Visual: all50 desktop and50 phone card models,14 regional views,18 final gating states,9 changed phone cards and5 final receptor-pool/focus close-ups inspected. Corrected label obstruction, transparency artifacts, attachment errors and camera clipping. Card undo/reload/lesson-return, keyboard controls and answer hiding pass.
- Live: Brain/Psyc HTTP200; four release assets (including lazy renderer and regional geometry) match built SHA-256; four study/data sources match normalized text. Production browser confirms regional thalamic nuclei and experimental NMDA flashcard with source/species disclosure; no console errors.
- Evidence: `docs/brain-anatomical-accuracy.md`; screenshots and audit reports in external `qa/anatomical-accuracy` folder, including `live-anatomy.png` and `live-card.png`.
- Limits: atlas surfaces are smoothed; tractography estimates pathways; experimental structures show fixed Cα conformations. Cell/circuit animations remain source-informed teaching models, not measured universal specimens or expert-certified replicas.
- Next: no required work remains.

## Brain learning systems — 2026-10-05

- Mode: continuation. Objective: animated flashcards and engaging learning loops, restrained progress feedback; preserve existing atlas/zoom fixes.
- Status: complete. Published `96bbc3f`; Pages run `37293962438` succeeded. Baseline `ba891c4` / code `6b75695`.
- Decisions:150 source-grounded recall/mechanism/application cards across50topics; eight animated schematic families; short spaced-review sessions with bounded retries, undo and local resume. Separate local review storage preserves existing saved/understood/quiz data. Existing question rounds remain available inside Practice.
- UX: due/new/reviewed counts, subject decks, confidence ratings, meaningful session summary; no badges, scores masquerading as mastery, or streak pressure. Links connect each card back to its 3D lesson; sequence/current-topic practice entry points.
- Verified: full npm test passes, including150-card provenance/coverage and review-engine scheduling, bounded retries, undo/reload and local-day checks. Strict TypeScript passed. Visible five-card completion, Again/undo/keyboard/reload/resume/model-return/quiz flow works;390/320layouts fit including long application answers.
- Audit fixes: independent session labels, deck keyboard focus, inert outgoing cards, cancellation on format changes, all topic references, single announcements and inactive animation cleanup. Eight visual families inspected front/back; corrected circuit feedback branch and larger callouts recaptured. Production preview confirms3Dinitialization/return, partial-session reload, references and sequence practice; no console errors.
- Evidence: `docs/codex/user-facing-tests/2026-10-05__user-facing-flow-test__flashcard-resume.md`; local screenshot/audit files in external `qa/practice` folder.
- Final checks: final build/strict TypeScript and focused Brain publication/content/review tests pass; corrected resume labels, six ratings for five cards, difficult retry scope and deck focus rechecked. Remote main matches baseline.
- Final visual audit: all16 settled desktop front/back captures pass, including corrected circuit and readable callouts. Saved-topic empty/three-card flow also verified on production preview.
- Live: Brain/Psyc HTTP200; five release JS/CSS/content assets match local SHA-256, unchanged study source matches after line-ending normalization. Production browser confirms150-card hub, channel-card reveal,3Dlesson link and return; no console errors. Screenshot `qa/practice/live-practice.png` outside repo. Viewport reset; temporary preview closed.
- Next: no required work remains.
- Assumption: original site-edit authorization includes normal tested production deployment. Review intervals are transparent simple heuristics, not a validated memory model.

## Brain zoom continuity — 2026-10-05

- Mode: continuation. Objective: smooth scroll zoom without disconnected model jumps; re-audit all models.
- Status: complete. Published `6b75695`; Pages run `37289319286` succeeded.
- Implemented:85 explicit views across50topics; wheel input accumulates eased camera goals without navigation; additive details fade; explanation tabs preserve camera. Macro anatomy/circuit/axon and channel gating/experimental views selected explicitly. Experimental structures remain static with no gating timeline.
- Audit corrections: independent schematic framing, camera-projected fit, visible exterior label anchors/outer-lobe whitelist, appropriate representation scale badges, rapid switch cancellation, keyboard focus retention, synaptic shaft–soma attachment, particle-independent electrical-synapse framing.
- Verified: full npm test, strict TypeScript, diff check.255 adjacent boundaries/full-range sweeps,5 wheel cases,21 timer cases,15 oblique fits;6,244 animation/LOD states. New guard coverage for external cortex labels, dendritic attachment and ignored particle bounds.
- Visual: all85 views at3 zoom distances (255 settled captures) plus36 paused later animation stages reviewed; all pass after corrective recaptures. Actual rapid inward wheel/reversal retains topic and representation with eased intermediate positions. Text-depth/camera independence, keyboard selection/focus, expanded Escape,390/320 layouts with no overflow, PHE914 chainA.1 selection at intermediate zoom pass; no browser errors.
- Evidence: local QA folder `qa/zoom-continuity` outside repository (inventory, macro/micro/animation reports, screenshots, baseline red and wheel trace). Original failure: two inward scrolls replaced cortex with unrelated diagram; regression was red before production changes.
- Live: Brain/Psyc HTTP200. Deployed page assets and lazy renderer SHA-256 match verified build; live browser crossed former switch thresholds while retaining brain/measured view; no console errors. Live screenshot saved, viewport reset, preview stopped.
- Next: no required work remains.
- Limits: schematics and measured anatomy remain explicitly separate representations; no fabricated microscopic continuity between unrelated datasets.

## Brain interface copy cleanup — 2026-10-05

- Mode: continuation. User requests removal of hero counters and promotional/poetic phrasing throughout Brain.
- Status: complete. Published `77e73d4`; Pages run `37284058516` succeeded. Removed top-right scale/topic/depth counters, hero/footer slogans; plain headings, study sequences, quiz feedback and20 curriculum display fields. Scientific explanations and interactions retained.
- Verified: full npm test; desktop study/sequence/quiz views and390/320 layouts, no overflow or console errors. Deep comparison confirms scientific lessons, questions, sources, IDs and sequencing unchanged.
- Live: HTTP200; fresh asset/script hashes match release; browser confirms counters and slogans absent, new headings/sequences/subtitles present, no console errors. Preview stopped and viewport reset.
- Next: no required work remains.

## Brain model refinement — 2026-10-05

- Mode: continuation. Objective: animated masthead; repair and visually audit every model; zoom-dependent hover and direct exploration; deeper, source-grounded models/animations at every scale.
- Status: complete. Published `f4f94e0`; Pages run `37283143689` succeeded. No unrelated changes.
- Implemented: animated orbital logo; semantic hover/focus; four zoom levels; accessible structure selection and trail; click/zoom navigation; staged animation scrubbing.50 distinct scene variants retain existing study content/progress.
- Assets: continuous native-resolution-derived cortex/cerebellum exteriors;25 HCP bundles/8,900 measured streamlines;8 complete molecular conformers;6 experimental channel C-alpha structures with individual residue hover; measured mouse dendritic arbor. Source/representation limits and licenses explicit.
- Visual evidence: all50 models reviewed in overview and fine detail (100 settled images); targeted corrected recaptures pass, plus3 deep-region mechanism regressions. Fixed cortex/cerebellum tears, clipped inserts, protein framing, stretched/obscured connexins, and optic-radiation context. Cerebellum uses posterior default; electrical synapses use frontal default.
- Verification: full npm test and final build/strict TypeScript pass.50 scenes cover3,964 animation/LOD frames and35 assets.100 unique final view inventory verified. Desktop pointer/structure selection, callosum→node→channel click and sustained wheel navigation pass; actual LEU297/chainA residue selection verified. Paused step/seek/selection-clear and dialog keyboard loop/Escape pass. Logo transforms animate.390/320 layouts, expanded controls, topic selection and depth preservation pass without overflow or console errors.
- Live evidence: `/brain/` HTTP200; all37 model/provenance assets, curriculum/study files and release JS match local SHA-256. Production browser renders repaired cortex and new controls without console errors; `/psyc/` remains200. Viewport reset and temporary preview tabs removed.
- Next: no required work remains.
- Limits: atlas envelope approximates gross anatomy; tractography is estimated pathways; experimental proteins are static C-alpha traces; custom motion/insets teach mechanisms rather than measured trajectories.

## Brain neuroscience explorer — 2026-10-04

- Mode: new task. Objective: create and publish `/brain/`, a futuristic neuroscience study guide spanning whole brain through tracts, cells, transmitters, channels and plasticity.
- Status: complete; published `bf93d12`. Pages run `37272412999` succeeded. Isolated clone from verified production `0bd017f`; existing `/psyc/` quiz and unrelated paused objectives preserved.
- Decisions: retain Astro/static GitHub Pages. Standalone unlisted route. Three.js only on Brain; eight connected scales, three explanation depths, guided paths and recall. User request on live domain authorizes publication after verification.
- Evidence: `/brain/` returned404; `/psyc/` has31 anatomy questions. Visual reference is YouTube Short `6oer0cd12Us`, an interactive anatomical atlas.
- Models: acquiring Allen human reference atlas2020 (CC BY4.0) geometry and RCSB6D6T receptor backbones (CC0). Explicitly distinguish measured geometry from teaching schematics.
- Implemented:50 topics across8 scales,3 explanation depths,4 guided paths, randomized recall/missed review, local saved/understood progress, search and8 interactive model modes.31 atlas surfaces+experimental receptor total3.25MB. Sources and license metadata bundled; 3D lazy-loaded. All50 deep dives enriched:7,446 instructional words,71 references. Full npm test, strict Brain TypeScript and model/content checks pass. Browser checks at1280/390/320 cover all8 modes, search, three depths, complete6-question round+5-miss retry, saved/understood reload persistence, guided steps and camera controls; no console errors or horizontal overflow. Independent review corrected chemical structures, channel direction, labels and lifecycle.
- Live verified: `/brain/` returns200 with complete guide; curriculum and all3 model/provenance assets match local SHA-256 exactly. Live browser renders atlas,50 topics and correct source labeling with no console errors. Existing `/psyc/` remains200.
- Next: no required work remains. Future expansion should add source-grounded lessons and retain measured-versus-schematic model distinctions.
- Assumptions: broad foundational neuroscience, with specialist detail progressively revealed. No claim of exhaustive field coverage or clinical utility.


## PSYC brain practice — 2026-09-30

- Mode: new task. Objective: build and publish `/psyc/`, first tab Brain anatomy, plain visual rapid-fire practice.
- Status: ready for publication. Isolated `codex/psyc` checkout starts at verified production `7750ba7`; unrelated paused work remains untouched.
- Decisions: reuse Astro/GitHub Pages; local licensed photos/MRI; ten-question rounds, topic filters, keyboard answers, instant feedback, missed-question review. Keep this study tool outside portfolio navigation/sitemap, following existing standalone tool routes.
- Implemented:31 source-linked questions, six licensed locally hosted images with attribution, seven verified photographic markers. External views distinguished from slice planes; hippocampus is not exposed on a true midsagittal cut.
- Verified: full npm test passes; final build, site verifier and six quiz tests pass after phone-scroll refinement. Independent anatomy/code review found no blockers. Browser checks at1280/390/320 cover scoring, wrong/right feedback, numeric/Space keys, auto-next, topic reset, complete round5/6, missed replay1/1, images and no overflow/console errors. Mobile next-question scroll verified.
- Next: publish one focused push, confirm GitHub Pages success and live route/assets.
- Assumption: requested work on the named live route includes publication. No hosting or DNS changes needed.

## Branded search visibility — 2026-09-30

- Mode: continuation. Objective: evaluate and improve portfolio search visibility. User authorized fixes and focused publication. Status: verified release prepared; Google indexing inspection remains pending.
- Baseline: all24 sitemap URLs returned200 with self-canonicals, unique titles/descriptions, oneH1, valid structured data and indexable responses. HTTP/www redirect correctly; unknown route404. Google displayed stale/different-site homepage title/snippet; cause unconfirmed, not evidence of a current canonical defect.
- Changes: visible homepage name and factual introduction/profile links; creator bylines on archive projects; Pip tour copy excluded from snippets with data-nosnippet. Exact public HTML ownership file added for Search Console; no DNS changes.
- Verified: full npm test and independent scoped review pass. Desktop1280, mobile390/320 and865 breakpoint checked; no horizontal overflow or console errors; keyboard focus visible. Existing content ordering, unlisted protections and research applications preserved.
- Release source: isolated clone from main aa9d3c1; unrelated stale/dirty original checkout untouched. Next: one main push, confirm Pages/live challenge, verify Search Console, inspect indexed homepage/canonical, submit sitemap and request recrawl. Search result updates remain controlled by Google; no ranking guarantee.

## EAD research briefing — 2026-09-30

- Mode: continuation. Objective: publish the complete parallel research index in the unlisted `/ead/` workspace. User explicitly requested the full release and accepted public hosting without authentication. Status: merged; published7750ba7; Pages36744857009 succeeded. All20 live HTTP/content checks and fresh production browser checks passed.
- Immediate name correction published as53de45a; Pages36742995311 succeeded and live title verified Low Exposure Operator. LEO alone remains in masthead. Exact uploaded lion and entry animation retained.
- Data:749 profiles (438 people,91 labs/teams,220 institutions),1410 relationships (1393 documented,17 inferred),389 sources (359 original+30 relationship references),7 classified reported cases,169 local images,21 city anchors,six topics. All original467profiles/588edges/492papers preserved. No isolated profiles; missing portraits use initials.
- Coverage: complete original index retained as `data/china-labs.json`; lossless indexRecord projection in china-map, including roles/history/works/funding/provenance. Full directory is default. Separate searchable paper/source collections and reported cases; documented/inferred links and allegation/rumor status stay distinct.
- Entry: exact LEO submission; uppercase input without length clues. Low/Exposure/Operator types, retracts and docks, lion pulses into atlas. Initial shell contains entry assets only; deferred loader waits for atlas readiness, failed loads offer Reload. No authentication or private origin.
- Verification: full npm test passed including67 entry and11 loader cases. Independent frozen-baseline verifier preserves all original records and exact raw-index fields; all169 images decode. Desktop/mobile browser checks cover default counts, sociology source-to-profile navigation, institution filtering, edge evidence, reported cases/search, catalogue pagination, original papers and implementation access. No console errors or horizontal overflow.
- Files: `src/pages/ead/index.astro`, `public/ead/`, EAD verifier/behavior scripts and baseline fixture. Privacy metadata, self-only CSP, no public navigation/sitemap listing preserved. Direct files/source public; no DNS/hosting changes.
- Isolation: release clone includes upstream586d871 and Operator53de45a. Original portfolio checkout and private research archives untouched. Full public index publication now explicitly authorized.
- Live verification: Operator entry,749 profiles,389 research sources,7 reported cases, exact release asset/data bytes and representative image hashes confirmed; no public homepage/sitemap listing. Earlier browser timeout recovered in a fresh tab. City dots retain exact anchors with compact nearby labels. Next: implementation-plan scope remains for user discussion.
## UC San Diego vehicle-theft opening — 2026-09-29

- Mode: continuation. Objective: make campus-safety open with an honest UC San Diego comparison per enrolled student. Status: complete; published as883c994, Pages run36602963774 succeeded.
- Verified existing 2024 snapshot: UCSD on-campus444 / fall enrollment44,256 ×1,000=10.03254; Riverside389 /26,384=14.74378. UCSD third among39 available institutions of42; second among nine undergraduate-serving UC institutions. UCSF is a graduate/professional health-sciences institution and must be separately identified. No nationwide safety ranking supported.
- New official UCSD2026 report located at the reused annualclery.pdf URL; source review confirms2024 motor-theft figures unchanged and2025 on-campus434. Older full-study snapshot stays explicitly dated25September; opening source check29September. Counts include electric scooters/bikes; no car-only count verified.
- Implemented: nine-peer opening plus all ten UCs/all42 switches, raw counts versus per1,000, same-year denominators and missingness, source links and public aggregate audit supplement. Prior housing/maps and full-study snapshot preserved; old mutable UCSD2025 citations point to captured source records. No nationwide or car-only inference.
- Verified: independent81input checks match original enrollment archive/source-cell sums;122group/metric rows and static defaults pass; full npm suite passes. Browser41checks cover320/390/1280layouts, all six group/metric states, missing values, hover/Escape, source-return links, school/table links, map/housing and no-script fallback. Small-card abbreviation spacing and bundled-inline navigation/CSP issues fixed; external-script regression guard added. Final copy-only build/static checks pass. Unrelated upstream BoomerKarma work preserved; no email requested.
- Live: seven supplemental assets and embedded comparison match local bytes; all six scripts load and external navigation matches exactly. Eighteen production browser assertions pass: mobile default9/rate, all42with39available, rawcountswitch, source/return and school→guide→table, exact444/44,256/10.03. No application errors or page overflow. Local native Chrome view-transition diagnostics are documented separately; no functional failure. Audit evidence in sibling research/ucsd_motor_theft_2026_09_29/qa. No required publication work remains.

## Boomer Karma — 2026-09-29

- Mode: continuation. Objective: append18 owner-requested score entries, net+450. Status: complete; published as `f7285cf`, Pages run `36546915191` succeeded. Full npm test and independent ledger review pass. Live total483 across all three bureaus; all30 entries match exact authored points/text and report date2026-09-29. Prior12 preserved and cat unchanged6; bureau release `7506489` and feline release `da751de` retained.
- Static Astro/GitHub Pages site retained. Human route `/BoomerKarma/` and feline route `/BoomerKarma/Kemberton/` stay unlisted/noindex. Ledgers in `src/data/boomer-karma.json` and `src/data/kem-karma.json` now total483 and6. No source screenshots, private photos, contact fields or credentials published.
- Human report: nine-step comedy application, three bureau gauges, score refresh and appeals. Cat report: independent five-step authorized-representative application, strict five-minute original-capture metadata, self-hosted on-device COCO-SSD recognition and live-camera fallback. Timing is disclosed after rejection per user. No timestamp/identity proof claimed; metadata is editable.
- Images resized/re-encoded before emailing, stripping original location metadata. No uploaded image persisted in source/browser storage. Camera/background/retry races covered; cat paperwork supplements precede photography. Repeat cat applications preserve access to already-issued report.
- Completed requests automatically email through activated FormSubmit; no per-request owner approval. JSON endpoint for text; native multipart endpoint for photo (AJAX silently drops files). Native success requires exact unique provider redirect. Inputs preserved on failure; duplicate lock and stable retry reference. Reports unlock only after confirmed delivery. Optional sessionStorage access flags contain no answers.
- Bureau engine: five escalating levels, separate browser-local division counts, named language flags, bounded40-event history, no stored text/photos/requested amounts. Deterministic joke rules; no AI intent judgment or identity inference. Blocked storage falls back to memory; test/visitor state separate; clear-history only removes own active key. Other devices independent, old emails not backfilled.
- Bureau desk: +0-only simulator, contradictory departments and nested referrals, fictional case law, five finite review layers, formal petitions. Repeat activity/min-max language adds up to three mandatory supplements to human/cat/appeal forms. Neither paperwork nor simulation alters real points.
- Email: unique reference subjects, Pacific timestamp, prominent submitted message, separately labeled answers, bureau sequence and stable explanatory context. Counts increment only after confirmed delivery. Bureau petitions have their own type; one new test verified extra answers, notes and unchanged20-point score, then labeled/archived separately. No actual visitor content stored here.
- QA: full npm test passes (13 engine,7 supplements,7 desk,8 delivery cases plus existing12 camera/app,33 freshness and publication/site checks). Independent reviews passed; score checks count even when an update is found. Required supplements, Back/retry, report return, no score leakage and duplicate delivery covered.
- Browser: actual human supplement request delivered; six escalating refresh jokes and counts persisted after reload; ambitious appeal required three supplements before sending; cat triggered extras before portrait. 320/390/1280 layouts inspected without overflow; console clean. No extra appeal/petition email sent during this QA.
- Prior live QA: real cat accepted at93% confidence; dog/stale/missing metadata rejected; actual16.7KB JPEG attachment verified in owner inbox. Model weight shards use .bin URLs; hashes verified on production.
- Bureau-release verification: both routes returned200 with bureau UI and current script hash URLs. All five public interaction scripts matched local bytes; page bundles loaded200, noindex/sitemap exclusions retained. Live browser initialized ordinary oversight with no test contamination or console warnings/errors. Subsequent authored score changes verified above.
- Next: no required work remains; no email sent for this score update. SMS deferred by user; no provider or phone number added. Joke gate is not access control; link recipients can read public content.
- Maintainer notes: `docs/boomer-karma.md`. Always use explicit test mode for live delivery checks; archive identified QA mail under test label. Visitor submissions preserved in Inbox. No DNS/runtime/hosting changes; unrelated state below preserved.

## Lunar report plain-language revision — 2026-09-28

- Mode: continuation. User requests approachable explanations, exact meaning of1.58%, Full/New comparison, prominent weekday controls and descriptive source scope. Status: complete; released as `846199e`, Pages run `36437853350` succeeded.
- Changes: explanatory hero, hypothetical10→10.16 entries per100 date-associated recording users, fitted curve versus actual days, separate phase-pair comparison, area-specific weekday-control panel. All21 model descriptions simplified. Exact statistics moved into expandable detail; chart relabels unchanged index values as percent from model reference, never an observed average.
- Scientific values, dates, source IDs, PDF and CSV outputs unchanged; independent numeric-field equality checked. Page remains unlisted/noindex. No new email requested.
- Verified: full site suite passes; final build/535 publication checks pass. Independent review checks21 model choices,105 percent readings,315 chart coordinates and unchanged scientific payload/PDF. Desktop/mobile320/390 visuals, sources, keyboard and repeated hero-link reopening pass; no page overflow, console errors or failed requests. Detailed audit in sibling `sex_lunar_analysis/publication/PLAIN_LANGUAGE_QA.md`.
- Live verification: page contains the revised embedded descriptions, all eight downloads match local bytes, five bundles load, noindex and listing/sitemap exclusions retained. No additional email sent. No required revision work remains.

## Lunar study publication — 2026-09-28

- Mode: continuation of the sibling lunar analysis. Objective: publish a polished standalone report page, keep it absent from homepage/Writing/Academics listings, then email the live link to the user. Status: complete; published as `1f82cf3`, Pages run `36423267252` succeeded, authorized self-email sent.
- Route: `writing/data-analysis/sex-and-the-moon/`; no archive entry; noindex and sitemap exclusion. Shared research styling with progressive detail, regional curves, all 21 planned models, sortable tables, mathematical notation and two-way source references.
- Scientific baseline: sibling `sex_lunar_analysis/research/exploratory_2026_09_27`; 1,812,110 feature logs, 730 dates, five areas/one app. Primary p=.039, bootstrap .026; Full/New interval includes zero. No population-wide behavioral or causal claim. June12 calendar check remains post hoc.
- Publication scope: derived estimates, methods, provenance and PDF. No raw daily source records. Existing campus/crime results and featured work remain unchanged. Source, numerical and browser/PDF checks precede the single production push.
- Verification: 518 static checks; all 21 models and 11,403 rendered chart coordinates, 18 sort orders, source/return navigation, keyboard and no-script views. Desktop1280/mobile390/320 and all five equations checked; no overflow, browser errors or failed requests. Eight-page PDF visually checked with 30 internal citation destinations; SHA25696fa5cb0913c1f8dc4a41391799bdfed554e956eeafa13869204fd3e977a82eb. Separate source audit passes. Shared font policy now explicitly permits bundled data fonts; scripts unchanged.
- Release verification: full merged suite passed locally and in Pages. Live route returns successfully; embedded data and all eight downloads match local bytes, five bundles load, homepage/Writing/Academics/All/Data Analysis and sitemap omit the page. Authenticated self-email succeeded. Upstream Lecture Study Guide publication preserved.
- Next: no required publication work remains. Optional future research seeks independent calendar-qualified diaries; existing HPTN access question remains unanswered and no research contacts were sent.

## Lecture Study Guide publication — 2026-09-27

- Mode: new task. Objective: publish the reviewed lecture-study-guide skill on GitHub and list it in the website's appropriate category. User explicitly authorized publication.
- Destination: public `BoomerRawlings/Skills`, `skills/lecture-study-guide/`; website `src/data/aiSkills.ts`, Projects → AI Skills (`/work/#ai-skills-heading`). Existing category and presentation reused.
- Status: skill published as `BoomerRawlings/Skills@decef73`; six skill files match the reviewed local source. No course transcripts, PDFs or private source material included.
- Verified: full `npm test` and `git diff --check` pass; local browser review confirms readable four-entry AI Skills shelf and exact GitHub destination. Existing skill order and full-project counts preserved.
- Website published as `baa3fd2`; GitHub Pages run `36327144143` succeeded. Live `/work/` returns HTTP 200 with Lecture Study Guide in AI Skills and the exact public repository link; refreshed browser layout inspected.
- Next: no publication work remains. Preserve unrelated objectives below.

## Resident gap completion — 2026-09-26

- Mode: continuation. Objective: pursue missing student-resident populations and expose qualified evidence honestly. Status: published as5d0f0b8; Pages run36239028314 succeeded. Bounded follow-up complete; unresolved research gaps remain documented.
- Added five observations: Yale fall2022–2025=6,255/6,064/6,011/6,082; archived official Stanford autumn2023=14,137. Independent source/date/scope review passes. 2024 count coverage33/42 unchanged; resident populations/rates13→14/42. 2025 populations2, complete combined housing rates0. Ledger169=126 enrollment+43 residents.
- Separate ledger:37 qualified observations/14 other schools, with actual partial, approximate and unresolved counts. Website explains evidence without using it in rates; unknown total means not yet verified, not absent public data. Cornell Ithaca8,861 has FY2024–25 scope and cannot normalize47institution offenses(45Ithaca+2Tech). Washington newest2025report listed but acquisition stopped at agreement; no terms accepted or institution contacted.
- Verification: full npm test passes;9,450 scientific and reader selections,29reader checks,94independent source/citation checks plus88broader checks/53claim groups,21static checks. Ten scientific outputs plus separate evidence ledger replay exactly from extracted ZIP; privacy scan passes. All offense cells, federal archive and Crime/Heat preserved.
- Visual: desktop1280/mobile390/320, neutral14/42opening, Yale2024rate9.32, Yale2025population/no rate, Florida partial8,941/no rate, source jump/return,7webmath elements pass; no overflow/duplicate IDs/console errors. Revised11-pagePDF all pages visually checked; root independently checked equations/new source table. PDF228,540bytes/SHA256ba542fa4a6d3a30d6dd2ba650d2644c8044a9ddab0b9e2b38638063ab1490ce3.
- Evidence/work: sibling research/resident_gap_completion_2026_09_26; published aggregate evidence under current-2026-09-25/expansion/resident-gap. Original source files retained locally, not redistributed. Live verification:20 assets match exact committed bytes, including PDF/ZIP/data/evidence/audits. Neutral14/42opening, Northeast→Yale selection, Yale2024rate9.32, Yale2025population/no rate, Illinois partial evidence and both source pages/return link pass; no console errors. ZIP1,941,250bytes/SHA256ad1531c2e2a1323ce073d0f11456abb7a698fee35bcb6a146825795e45627d83;218manifestentries/26interfacesnapshots. No required release work remains; no new email or monitoring.

## Resident-gap reassessment — 2026-09-25

- Mode: exploration/diagnosis. User challenges missing documented residents after expansion. Status: diagnosis complete; published data unchanged.
- Verified baseline:2024 resident populations13/42;29 not adopted. Of those29,20 have a complete housing offense count. Missing is not proof of no published population: candidate ledger includes actual partial/qualified observations;10 schools have narrative searches but no individual candidate row.
- Issue: website's generic Not available label combines unverified sources, partial populations, wrong periods and unresolved student/geographic definitions. Current exact-total eligibility rules may hide useful qualified/main-campus observations. Prior completion claims do not establish exhaustive acquisition.
- Research: sibling research/resident_gap_reassessment_2026_09_25/. Independent public/private reviews confirm exact partial/qualified observations at Georgia Tech, Washington, Illinois, Cornell and Penn. Georgia Tech2024occupancy9,892 has unresolved person/unit basis; family eligibility alone does not prove dependent inclusion. Geographic proxy criteria must be consistent with accepted Stanford/CMU. Cornell population excludes Tech while current housing counts include Tech, a known mismatch.
- Next: distinguish not-yet-verified, partial, approximate and unresolved definitions; retain documented context and pursue compatible campus-level numerator/population pairs. These changes remain unimplemented. No new complete denominator or rate adopted; no external contact or website mutation in this diagnosis.

## Coverage expansion — 2026-09-25

- Mode: continuation. Objective: expand actual housing populations and recheck newest reputable campus reports across all42 schools. Status: published as e947bd0; Pages run36216780650 succeeded.
- Verified:42 latest-report checks;36,652 source cells/217 branches;39,268 geographic cells;9,450 rates. 2024 combined housing counts29→33/42; documented populations11→13; usable rates10→13. Five adopted observations: Stanford2024/2025 and Carnegie Mellon2022–2024. 2025 has one population but no complete combined housing rate.
- Recovered Merced/Harvard/Hopkins/UVA originals and newest Stanford/Princeton editions; independent source and numerical audits pass. Harvard missing geographic columns remain unknown; Stanford combined violence definitions withheld. Texas resident figures withheld because student-only scope unresolved.
- Preserved: federal archive, Crime/Heat and map opening. New population ledger gives dates, source hashes and scope;87 candidate records retain exclusions. Stanford2024 university-authored publisher-hosted PDF explicitly qualified.
- Verified: full npm test PASS; all164 population observations independently checked; source/citation80/80, reader9,450selections/23checks, static21checks, map17checks, independent integration41checks. Clean ZIP replay reproduces all10 products exactly;203 manifested assets/25 interface snapshots pass. Desktop1280/mobile390/320, sorting, source returns and formulas pass; all10 PDF pages visually checked.
- Final package: ZIP1,876,578bytes/SHA25616ceeeac1e6e31e0b1e53ef8d0d43be5ef3bf05956d0edf0162d6b014c2437b6. PDF223,688bytes/SHA256f8c7deed2cc17897077b48565f62bd2592f89e9d58a232f62a975ec87cadb97b. Federal/Crime artifacts byte-identical. Live verification:16 assets match exact committed bytes, including PDF/ZIP/data/source ledgers. Neutral opening13/42; region-to-school selection, CMU2024rate1.00, population disclosure, source jump/return and Stanford2025documented-population/missing-rate behavior pass; no console errors.
- Next: no required work remains for this expansion. Remaining29 institutions lack a paired2024combined housing rate; candidate ledger records unresolved population/geographic gaps. No new email or automation.

## Geographic school navigation — 2026-09-25

- Mode: continuation. Objective: clickable U.S. map, region focus and school selection. Status: published ase529829; Pages run36213241823 succeeded.
- Native accessible controls, region-to-school flow, nearby-school clusters, search/list fallback and neutral opening. Static Census-derived state outlines and frozen official NCES HD2024 home-campus coordinates; map encodes location/navigation only, no crime values.
- Housing data collection remains unfinished and preserved below; no scientific/PDF changes in this presentation task.
- Verified: full npm test passes;137 current artifact hashes,18 interface snapshots; independent map42schools/51geometries/17checks, reader9,450selections/23checks, citations41groups/61checks. Desktop1280/mobile390/320, all4regions, exact school preservation, clusters, Enter/Space, reset/global-search/deep links/source returns pass; no overlap/overflow/console errors. Map source replay exact; all scientific/PDF/federal/Crime bytes preserved. ZIP SHA25675319a9454e2bed4ea2cca6e8e6a575257cb2a444d637018332652bb245b439a.
- Live: national four-region map, regional focus, nearby-school chooser and school explanation verified; San Diego State2024combined housing count7 retained. Twelve live assets match committed bytes, including ZIP/manifest/map/source evidence; no console errors.
- Next: no required work remains for map navigation. Separate housing-population acquisition remains unfinished as recorded below.

## Housing coverage diagnosis — 2026-09-25

- Mode: exploration continuing campus study. User challenges10/42housing-rate coverage. Status: collection diagnosis complete; bounded external source leads recorded separately. No publication/data mutation.
- Verified:2024combined housing offense counts available for29/42; adopted resident populations11/42, all California State Auditor; rates10/42. The other31 population gaps do not establish absence of public data. Exact missingness in sibling research/housing_coverage_2026_09_25/COVERAGE_DIAGNOSIS.json.
- Diagnosis:19schools have usable combined housing counts but lack adopted resident populations;12lack both, Merced lacks count only. The10available rates are allCalifornia. Prior crime-source refresh retained frozen resident populations; broad housing-population acquisition remains unfinished.
- Next research priority: verify same-year actual resident headcounts for the19count-ready schools, reconcile geographic scope, then separately resolve13crime-count gaps. Official source leads require retrieval/year/scope qualification before adoption; no expansion claimed.

## Layperson overview — 2026-09-25

- Mode: continuation. Objective: add a concise general explanation above the school finder, preserving neutral launch. Status: published as7a71e57; Pages run36211038771 succeeded.
- Explains counts versus population-adjusted rates, reporting geography, verified 2024 combined housing-rate availability and how to explore the study. Existing citation/backlink system reused. No scientific data or PDF changes.
- Verified: source/citation audit39groups/58checks; reader9,450selections/20checks; four overview source/return links; desktop1280/mobile390/320; no overflow or console errors. Full npm test passes;121current artifact hashes. ZIP SHA256 8626cad6fed3962c7164af41770201771dd3e6aef5984ad34895ff8866598d3f.
- Live: overview visible above finder, no school preselected; four citations and actual source/return navigation verified. Eight live assets match exact committed bytes, including ZIP and manifest.
- Next: no required work remains.

## Opening-view simplification — 2026-09-25

- Mode: continuation. User feedback: first launch remains overwhelming and overly focused on UCSD/SDSU. Status: published as eef03b8; Pages run36207614686 succeeded.
- Short broad introduction, search and regional browsing. No school selected until explicit choice; regions never auto-select a school. Valid school/region links retain intended state. School-specific findings, coverage and sources use progressive disclosure.
- Scientific inputs, calculations, PDFs, 151 federal artifacts and 330 Crime/Heat artifacts unchanged. Campus presentation amendment, 13 interface snapshots and 121-entry manifest refreshed; ZIP SHA256 a08e9c30fe4e6b599db5336ee096af3b1218c6568e1a0c2175d0e9dc278bf6a8.
- Verified: full npm test passes. Reader audit 9,450 selections/19 checks; citation audit 39 claim groups/57 checks. Desktop1280/mobile390/320, blank launch, all five regions, search, explicit choice, missing values, citations/return links and school/region/source deep links pass. No overflow, duplicate IDs or browser errors.
- Live verification: neutral opening, region browsing without automatic school selection, explicit school details and missing-value behavior confirmed; no console errors. Twelve live assets match committed bytes, including manifest, ZIP, amendment and interface snapshots.
- Next: no required work remains for this presentation revision.

## Current publication revision — 2026-09-25

- Mode: continuation. Objective: publish current-source Campus Safety and Crime/Heat review, now with a plain-English campus overview, searchable regions/school cards and selection-specific explanations. Status: published as fc433f0; GitHub Pages run36206462288 succeeded.
- Sources: all42 institutional inventories searched;39 extracted, with Virginia provisional. Merced/Harvard/Johns Hopkins reports unverified. Ambiguous cells withheld. Original federal snapshot retained. No qualified2025 population adopted; rates unavailable.
- Numerical verification:33,460 source cells,9,450 current rates,35,848 geographic cells; independent audit passes. Reader adds9,450 school/category/year/location explanations; independent calculation checks pass. Source/citation and PDF visual audits separate.
- SDSU2024: housing1, campus1, noncampus2, public0; all-area3. Geography difference, not revision. Verified2023housingrape7→8 is a separate revision; pooled2022–24housing18/24,386×1,000=0.74. Current2025mainhousing10/campus11/noncampus5/public0,total16. Current2026ASR covers2023–25, not2026.
- Current source: SDSU official listing links `asr_2026_newdraft.pdf`, SHA256 `8d697b9134573a07dd7d53a0db29c18f8fe3a5b97e026fb8221237766155c80b`. Older inconsistent2026 PDF excluded.
- Crime/Heat:partial2026SDPD57,037(+244), throughSep24. Historical model inputs/results unchanged within checked scope; full Open-Meteo panel not reacquired. Safe aggregate refresh only.
- Reader:4 home-location regions plusAll;42 school-specific notes;15categories,5periods,3location choices. No regional safety rankings or pooled regional risk claims. Advanced tables/methods preserved behind disclosure; fragment links reopen their sections. Region describes home location, not branch footprint.
- PDFs:9-page current campus report and2-page Crime/Heat refresh, exact final versions rendered/checked. Source updates and interface snapshots packaged separately from original archive.
- Final verification: full npm test passes;119 current campus artifacts,151 archived campus artifacts and330 Crime/Heat entries verified. Eight current outputs replay byte-for-byte;9,450 new rates and9,450 reader selections checked. Citation audit39claim groups/57checks; desktop1280/mobile390/320, sorting, links, tooltips and7equations pass;11PDFpages inspected. Current campus ZIP SHA256 e7c7579809aae917d05031f5dcfa0bf33877ceb87d3ec2d56cfff33329779bba.
- Live verification: both pages show new content;16 key assets match exact audited bytes (including2PDFs/2ZIPs). Live school search, SDSU2024all-area3 and geographic handoff work. Current guide defaults to residents; archived source preserved. Scientific gaps remain explicitly unavailable, not silently substituted.
- Next: no required work remains for this release. No new emails or monitoring scheduled.
## Campus safety analysis

- Continuation: report-year options now 2022, 2023, 2024, pooled; explicit 2024 default retained. Single-line presentation change, scoped audit/hash update, full npm test and package integrity pass. Published1393857; Pages36187597382 succeeded. Live options2022/2023/2024/pooled and2024reset verified. Commit-versioned requests verify151manifest entries/15downloads; unversioned ZIP still held preceding presentation revision in CDN at check (scientific bytes unchanged). New ZIP1,942,008bytes/SHA b08fef96. Requested year ordering complete.

- Continuation: resident-focused campus explorer and homepage highlights implemented. Default residential counts / documented occupants, 11 denominator-covered institutions; all42 optional, missing values retained. Both analyses replace Research Briefing Assistant and Research and Publishing Systems among seven homepage highlights; removed entries remain published. Independent source/code reviews and 7,560-rate checks pass, 52 citations/33 sources, original PDF/data unchanged. Desktop/mobile browser behavior and formulas verified. Final package and full npm test pass: 151 archive entries/public artifact hashes, ZIP 1,941,547 bytes / SHA 6d03c01f. Published as fc7a57c; Pages run 36187129919 succeeded. Live manifest151 and15 exact download hashes match; homepage seven highlights, resident default11/UCSD2.37, sorting/reset,52 citations and7 formulas verified; no browser errors. No required work remains.

- Presentation continuation: four sortable columns with both directions, unavailable values last, full-name ordering, synchronized dropdown/URL and keyboard focus. First-use expansions plus hover/focus/touch definitions; native options use full names. 51 numbered subscript citations, 32 source entries and 51 exact return links. Source/content review, full npm test and desktop/390/320 browser checks pass; seven formulas preserved. PDF and all numerical inputs/outputs unchanged. Revision audit preserves original hashes/check counts. Current package: 149 files, 149 public artifact hashes, ZIP 1,932,968 bytes / SHA dce400cb. Published as `8bf213c`; Pages run `36184191801` succeeded. Live: 149-entry manifest and 14 exact artifact hashes match; sorting, definitions, source jumps/returns, no overflow or console errors verified. Next: no required work remains.

- Mode: new task. Objective: publish a rigorous interactive campus-crime comparison under Writing → Data Analysis, emphasizing population-normalized rates; independently audit calculations/formulas, related research and every citation. Previous Crime and Heat work remains complete and untouched.
- Status: published as `3426e79`; GitHub Pages run `36123490427` succeeded. Study, seven-page PDF and reproducibility package complete; source/calculation, separate citation, responsive/browser/PDF and offline-reproduction checks pass. Dataset: 42 institutions, 212 reporting campuses, 126 annual headcounts, 33 occupancy values, 15 category views and 7,560 annual/pooled rate rows. Work in `campus_safety_analysis/` (sibling of website). Protocol fixes 42 institutions and calendar report years 2022–2024 before calculating cohort rates; latest public federal collection verified as 2025.
- Decisions: distinguish enrollment-normalized on-campus reports from housing reports normalized by actual residents; missing values never zero; housing is a subset, not an additional geography. No safety ranking or victimization-risk claim. State-audit resident occupancy requires geographic qualification until property-level alignment is verified.
- Verified: public OPE data API exposes 2025 collection with 2022–2024 data. UCSD 2025 ASR revises prior years; citation/discrepancy ledger required. Shared user chat supplies research leads, not evidence. No new emails authorized or sent.
- Verification: independent source re-extraction and two independent rate checks agree exactly; 36 institutional ASR rape cells reveal two UCSD 2022 discrepancies versus the federal file. Default 2024 has 42 complete institutional rates; pooled totals unavailable for six. Housing 2024 uses 103 numeric and 109 explicit no-housing branches; no historical backfill. SDSU 2024 enrollment difference (41,137 versus 39,373) remains unresolved. All seven PDF pages and the final citation wording correction verified.
- Live: study and Data Analysis index verified; all 147 manifest entries match, 13 downloaded artifact hashes match, seven MathML expressions render, UC resident filters work, desktop/mobile equations show no clipping, no console errors. Route: `/writing/data-analysis/campus-safety/`. Next: no required work remains; unresolved source/scope limits remain explicitly documented. npm test passes: 25 public pages, five unlisted, six redirects, 7,560 cross-runtime rates, 147 artifact hashes and seven MathML expressions. PDF: 206,075 bytes, SHA 8a0efc6b; archive: 1,865,846 bytes, SHA d5dd6b1a. Clean offline data replay and portable audit recorder pass with identical outputs.

## Crime and heat publication

- Source expansion published: contentfc3eb06 plus audited-log inclusionfix1ebbb26; Pages36073360166 succeeded. `data/source-expansion-1/` has125newassets: separate DOJ/local/NOAA/Census aggregates, source hashes, code and4pagePDF. Existing166artifacts/model estimates unchanged. DOJ flags incomplete Sheriff submissions Nov–Dec2024 andJan–Jun2025; exact export overlap unverified. Independent reconciliation/full hourly checks, PDFvisualQA, npmtest and320/390/1280browserchecks pass. Combined14.2MBarchive clean extraction: hashes, threeofflineaudits, reproducedCSVcontents andrelativeMDlinks pass. Live291entrymanifest/12artifacthashes/16MathML and browsersection verified. No new effect models or emails. Further models require explicit outcome definitions and reporting-gap sensitivity; old revision manifest finalizer must retain this new folder.

- Mode: continuation. Objective: address methodological feedback, update the general arrest-record/heat webpage and standalone DV PDF. Published as651acd1; GitHub Pages run36070661540 succeeded; live verification passed. Previous production cb7da91; requested prior emails already sent. No new email or agency request sent.
- Route: `/writing/data-analysis/crime-and-heat/`, under Writing → Data Analysis. Legacy `/data-analysis/` routes redirect; asset base unchanged. Source work remains in sibling `dv_heat_analysis/`.
- Source: 214745 rows,4 invalid,214741 charge lines,926 exact duplicates,136313 source-ID groups;12478 coreDV. Partial2018,incomplete2025,no2026.2024 retains Incident Number;2025 changes identifier. Agency/date/location meanings and completeness unverified. Public aggregates only.
- Original full reference retained: general58770groups/106ZIPs,+1.87% per10°F,CI−0.05%to+3.83%,p=.05608;DV6637groups/95ZIPs,+2.89%,CI−1.05%to+6.98%,p=.15258. All67original artifacts preserved; originalPDF archived separately.
- Revision:64/112ZIPs,175424 civil-day weather rows; provider daily quota stopped acquisition,48ZIPs remain. Nonrandom subset captures57903general/6501DVprimary groups. Corrected IANA boundaries include23/25hour days;509start boundaries/513whole windows differ in2021–24. Explorer uses64ZIPs; full-record totals unchanged.
- Fixed retrospective battery:22fits/24tests, R00 paired legacy weather, R0civil maximum, lag, humidity/rain/holidays, local annual seasonality, warrant exclusions, combined/spline, pairedNOAA, durationoffset. Corrected R0general+1.9074%,CI−0.0234%to+3.8756%,p=.05287;DV+2.7405%,CI−1.2322%to+6.8730%,p=.17903.3nominal tests<.05;noneHolm<.05(min.39844). No causal/equivalence claim.
- Strict warrant samples52203general/6435DV; original full52989/6570. NOAA46eligibleZIPs/66829pairedZIP-days. SeasonalDVseparation in2sparseZIPs resolved through certifiedextendedMLE, retaining all positive counts and full-calendarHAC. Numerical amendment public.
- Verification: independent designs/covariances/splines/Holm pass; all22fits reproduced exactly from extracted122file aggregate package. Weather regrouping/source masks separately audited. Computational checks are not human peer review or agency authentication.
- Deliverables: revised study, full results/issue response, agency draft,166manifestedartifacts. New14pagePDF272153bytes SHA256667ba853809976e4bc2edbb5bef0708f5f0cf673375b840c5f3eb02fdc6aabf0. Original12page267003bytes SHA256babe621e7f08aea6d949f3d2f760998e6a4f382af3db2ede0f20da1d16cc3832.
- UI/checks: desktop1280/mobile390/320,16MathML expressions, no clipping/page overflow/errors; actual CSV1461dates/6501DV/93504ZIPdays/IANA23–25hours verified. Vista19315all/1727core unchanged; no population-risk interpretation. npm test passes24public/5unlisted/6redirects,16data tests,22fits/24tests andassetchecks. Live manifest166entries,10selectedartifacthashes (including both PDFs and20.26MB audit ZIP), clientJSbytes and16MathML verified. Liveexplorer57903general/6501DV groups loads correctly. Final asset-only refresh verified before push.
- Remaining:48ZIPhourly acquisition when permitted quota available; agency confirmation of extraction/coverage, unit/date/geography and2025gaps. Prepared draft notsent; no scheduled retries. Preserve unrelated objectives below.
## SWC Restorative Justice application

- Mode: new task. Objective: publish the user-supplied Restorative Justice application on `/swc/`.
- Status: published as `e8ee688` on 2026-09-21; GitHub Pages run `35656640650` succeeded. Preserve unrelated paused work below.
- Reviewed both scanned pages: Southwestern College application and course registration for Richard J. Donovan Correctional Facility; identity fields blank. Source kept byte-identical, including its preselected educational goal.
- Decision: reuse the document preview/download component; insert before Transcript Envelope Labels so existing relative order and labels-last placement remain intact.
- Source SHA-256: `0b851e501f4a10376769b89b3cc6d08b2940e93ff54193f6b7a5c44c21203c40`.
- Verification: `npm test`, diff check, and independent source review pass. Both 773x1000 previews visually reviewed. Browser opens the correct two-page dialog, loads both images, and closes with Escape; download points to the source-identical PDF. Browser screenshot capture unavailable.
- Live verification: `/swc/` returns HTTP 200 with the new preview/download and preserved noindex directives. PDF and both previews return HTTP 200 with source-matching SHA-256 hashes.
- Next: no remaining work for this update.

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


## EAD network and navigation refinement — 2026-09-30

- Mode: continuation. Objective: readable full network prioritized for secure agents; LEO returns to intro; lion opens poems view. Status: published1dc8742; Pages36763340770 succeeded and24 live asset/data/privacy checks pass. Preserved concurrent3d0416c and reran combined full npm test successfully.
- Network: all749 profiles retained; source-based High relevance/Relevant/Context/Needs review tiers for personality, memory, tool use, process adherence and agent safeguards. No special Yue starter or sort preference. Click cards to focus direct neighbors; paged card layout, gutter connections and grouped evidence preserve every record. Relevance reasons and excerpts link to sources.
- Navigation: LEO collapses to a cleared exact-key entry; repeat launch reuses loaded data and replays reveal. Lion opens personal poems view; back preserves research state. User-supplied poem displayed; no authentication or privacy claims added.
- Verified: full npm test passed (73 entry,11 loader cases); 11000 layouts across11 widths, all749 profiles/direct neighborhoods and26994 connectors. Desktop/mobile browser checks cover cards, grouping/source drill-down, exact badge hit target, selection clearing, page changes, relevance/empty filters, context preservation, key rejection after reset, keyboard activation and repeat launch. Final tiny focus-scroll adjustment checked separately. Public data unchanged; no new dependencies.
- Next: implementation-plan purpose remains for later discussion. QA evidence: web/qa/network/ in research workspace. All13 local browser checks passed; production bytes match tested release.

- Release follow-up: production browser retained old unversioned UI assets despite correct origin bytes. Added shared release query version to initial entry assets, workspace HTML, and all deferred CSS/JS; loader/release tests enforce consistency. Full suite passed; final route build and publication pending. Future UI releases must bump LEO_ASSET_VERSION and matching entry-shell URLs.

- Poem: one continuous serif article. Original opening/body wording remains exact; approved rhyming ending has the latest user correction.39 paragraphs,58 lines,2 thematic breaks. Independent frozen-prefix hash and exact-ending regression checks pass; revised ending visually verified. Build, loader11cases and unlisted release checks pass. Entry/deferred asset version20260930-poem-2. Publication in progress.

- Previous release1006cba published; Pages36769531456 succeeded with full CI suite. All24 live asset/data/privacy checks and original-poem exact-text hash passed. Only approved ending and associated cache version/integrity test change in this release; unrelated website content preserved.

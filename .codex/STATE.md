# Project state

- Mode: continuation
- Objective: publish the authored Little Workshop prologue as the unlisted `/aristotter/` page.
- Status: production route and deploy snapshot are being verified; push and live verification remain.
- Preserved paused work: unrelated local Pip/global-style changes remain unpushed and must not be overwritten.

## Completed

- Implemented the flat two-character, one-object prologue: 50 authored interactions, progressive object drawer, three placements, awareness boundaries, strawberry choice, Unicode name stop, and browser-local semantic persistence.
- Added opt-in procedural Web Audio voices with deterministic four-second plans, distinct Pyotter/Mikwhale profiles, five active visemes plus rest, and clean interruption/disposal.
- Added `PyotterPuppet.astro` and `MikwhalePuppet.astro`. Each keeps one whole authoritative portrait visible and stationary; transparent articulated overlays provide motion without slicing or reassembling base art.
- Exposed 14 shared roles per character: head, paired eyes, nose/blowhole, fur/beard, ears/side curls, paws/flippers, chest, torso, paired feet/flukes, and tail. Each role nests `data-voice-part` inside `data-idle-part`.
- Added two closed-eyelid overlays per character. They default to opacity zero and blink together through opacity keyframes while the original open eyes remain untouched.
- Rebuilt `little-workshop-idle.ts` as 50 deterministic, unique 20-second articulated variants per character. All 14 tracks exist, inactive tracks remain identity-only, endpoints are identity, and the whole-rig compatibility clock never moves.
- Added `little-workshop-performance.ts`: deterministic Web Animations speech phrases with shared head/chest rhythm, synchronized eyes, one limb gesture, ears-or-tail emphasis, sparse face/fur accents, smooth identity recovery, reduced-motion handling, and no per-frame loop.
- Integrated idle, performance, voice hooks, cancellation, reduced motion, visibility, and scene teardown in `LittleWorkshopScene.astro`.
- Added an original, Animal-Crossing-adjacent welcome plaque: visible semantic H1, sprout/ripple motifs, inclusive tagline, restrained CSS drift, static reduced-motion behavior, compact desktop overlay, and normal-flow mobile layout. Desktop dialogue fades the plaque so speech is never covered.
- Replaced drawer `scrollIntoView()` with rail-only centering and added flex/grid containment so responsive object selection and puppet overlays cannot move the page horizontally.
- Renamed the sole page route from the never-published `/little-workshop/` path to `/aristotter/`; retained noindex/nofollow/noarchive/noimageindex and no-referrer metadata, with no navigation or sitemap entry.

## Decisions

- The untouched portrait is the seam-safe visual authority. Overlay motion may add expression but must not expose crop seams, holes, or duplicate anatomy.
- Animate named anatomy, not the whole portrait. Parent overlay motion carries descendants; idle and speech use separate nested layers.
- Blinks reveal paired closed-eyelid overlays with opacity. Never independently squash or move the base eyes.
- Speech body language stays sparse and coordinated: at most nine active tracks, one paw/flipper, and ear-pair or tail emphasis—not both. Mouth remains owned by visemes.
- Keep voices procedural, local, opt-in, and supplementary. Keep state browser-local and semantic only.
- Keep the welcome header decorative and noninteractive. It may yield visually to dialogue but must remain the page's semantic H1.
- Future conversation pacing is deliberately nonlinear. `Normal` is the shortest total experience. `Fast` increases vocal delivery speed but unlocks enough additional dialogue/argument/detail that the exchange takes longer overall; `Slow` lengthens delivery and pauses, so it also takes longer overall. Treat this as authored content-density behavior, not a global playback-speed multiplier, and label it clearly when implemented.
- Do not add a room, movement, inventory management, crafting, AI runtime, or content after interaction 50 without approval.
- Publish only runtime code and required art. Keep internal source notes, pasted philosophy files, reference atlases, and build-only design documents out of the public repository.

## Verified

- Production `npm test` passes on 2026-08-28: static build, public/unlisted route counts, no public Aristotter link, sitemap exclusion, privacy metadata, performance, voice, and idle contracts.
- The deeper local contract suite also passes: 50-step branching and awareness boundaries, browser-local semantic state, worldview, character parity, both rig contracts, and interaction structure.
- A local corpus probe covered all 448 authored/reuse utterances: deterministic plans, at most nine moving speech tracks, synchronized eyes/head-chest rhythm, one-sided limb gestures, and mutually exclusive ear/tail accents.
- Header/browser QA passed 320×568, 375×667, 390×844, 844×390, 1024×600, 1160×1542, and 1280×720 with no horizontal overflow or automatic document scrolling; short layouts retain the drawer and voice control. Full `npm test` and `git diff --check` pass on 2026-08-28.

## Next

1. Verify the exact curated commit, push `main`, wait for GitHub Pages, and inspect `https://boomerrawlings.com/aristotter/`.
2. Await approval before expanding the experience or adding real access control.
3. When conversation controls are authorized, design normal/fast/slow around the nonlinear duration rule above.

## Risks

- Link-only plus `noindex` is obscurity, not authentication.
- Browser-local state does not sync and can be cleared.
- Web Audio/autoplay behavior varies; the silent experience must remain complete.
- Transparent overlays are intentionally subtle; browser QA must confirm they read as articulation without tinting, doubling, or separating from the untouched base art.

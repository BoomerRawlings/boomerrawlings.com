# Little Workshop: authored prologue contract

Status: authored-prologue alpha. “Little Workshop” remains a working title. The current runtime is an unlisted, local-first prologue for Bailey; it is not the previously planned room or movement simulation.

## Current surface

The page opens directly onto one flat 2D stage:

- Pyotter stands on the left;
- the middle remains empty until Bailey selects an unlocked object;
- Mikwhale stands on the right;
- dialogue appears beside its speaker; and
- interactions 1–48 place a progressively unlocked, horizontally scrollable object drawer below the characters, followed by exactly **Give to Otter**, **Set Between Them**, and **Give to Whale** after selection.

Drawer entries use visible object names and a native, keyboard-operable single-selection control. The rail preserves a visible horizontal scrollbar on narrow viewports. Selecting an object previews it between the characters; placement actions remain hidden until selection. The drawer and placement actions are unavailable while a reaction is playing.

There is no room, camera, map, pathfinding, direct character movement, keyboard movement, HUD, inventory management, crafting interface, resource loop, or OpenAI call. The drawer is an authored object selector, not a stockpile: objects cannot be collected, consumed, rearranged, traded, or crafted.

## Voice and mouth contract

Character voices are optional, procedural “animalese”-style chirps synthesized with Web Audio from the visible authored text. The runtime makes no voice, speech-service, media, or other network request and ships no recorded audio asset. Voice playback defaults off. Bailey must explicitly turn it on, which also provides the trusted gesture required to create or resume the audio context; the enabled preference is then stored locally and can be turned off again.

The profiles must remain recognizably separate:

- Pyotter is higher pitched, brighter, and quicker;
- Mikwhale is deeper, warmer, and slower.

Speech planning is deterministic for the same character, text, and seed and is capped at four seconds per displayed dialogue beat. Punctuation creates rhythm without extending that cap. Starting a new line interrupts the prior utterance; disabling voices, rerendering, or leaving the page cancels scheduled sound and returns the mouth to rest. Silence and unsupported Web Audio never block dialogue or interaction progression.

Each character has five active mouth shapes—small, open, wide, round, and smile—plus rest. Mouth changes are scheduled from the same speech plan as the chirps, so animation follows the audible events rather than a detached timer. Completion, cancellation, and interruption always restore rest. With reduced motion requested, the speaking character holds one restrained small mouth instead of rapidly cycling visemes.

## Seam-safe articulated puppet contract

The authoritative portrait for each character remains one whole, untouched base image. It stays visible and stationary; the runtime never slices, masks, reassembles, or transforms that image into moving anatomy. Motion instead belongs to transparent full-canvas overlays above the base. This preserves the source art continuously and prevents crop seams, holes, and duplicated edges when a gesture begins or ends.

Each puppet exposes the same 14 canonical roles: **head, eye-left, eye-right, nose, fur, ear-left, ear-right, paw-left, paw-right, chest, torso, foot-left, foot-right, and tail**. For Pyotter these mean nose, ruff, ears, paws, and feet; for Mikwhale the same engine roles mean blowhole, beard, side curls, flippers, and flukes. The mouth is a separate SVG viseme overlay and is not one of the 14 body-performance roles.

The overlays form an anatomical hierarchy so parent motion carries descendants. Torso contains chest, limbs, and head; head contains ears or curls, eyes, fur or beard, nose or blowhole, and mouth. Mikwhale's tail carries his flukes. Each body role has an outer `data-idle-part` layer and a nested `data-voice-part` layer, allowing idle and speech motion to compose without either replacing the other or moving the base portrait.

Each character also has two dedicated closed-eyelid overlays. They default to opacity `0`; a blink reveals both with synchronized opacity keyframes, then returns them to `0`. The original open eyes remain untouched underneath. Blinking must use these paired opacity overlays rather than independently squashing, translating, or redrawing the base eyes.

## Continuous idle and speech-performance contract

Each character owns exactly 50 deterministic, unique 20-second idle variants. Every variant defines all 14 canonical part tracks, but roles outside that variant's coordinated motif remain identity-only. Active tracks use compositor-friendly transforms, except the paired eyelids' opacity pulses. All tracks begin and end at identity, so shuffled variants chain without a snap. The whole-rig compatibility clock is identity-only: whole-character rocking is never the primary idle motion.

Pyotter and Mikwhale independently shuffle complete 50-variant libraries and avoid an immediate repeat across cycle boundaries. Binocular eyes share timing exactly; chest and torso breathe together; other motion appears in semantic groups such as head with ears, one limb phrase, tail with feet or flukes, or nose or blowhole with fur or beard. Pyotter remains quicker and brighter; Mikwhale remains deeper and more measured.

`little-workshop-performance.ts` converts each deterministic speech plan into a bounded Web Animations phrase before playback; it uses no animation-frame or per-frame JavaScript loop. A long utterance activates at most nine part tracks: shared head/chest rhythm, one exactly synchronized eye track, at most one paw or flipper gesture, either an ear-pair or tail emphasis, and sparse nose/blowhole and fur/beard secondary motion. Torso stays planted; feet or flukes either stay planted or inherit tail motion. Every planned and live intensity-correction accent returns to identity; cancellation settles Pyotter in 130 ms and Mikwhale in 210 ms. Mouth shapes remain exclusively owned by the voice-viseme system.

Authored speaking, thinking, looking, and action states use the same nested speech layers with 360 ms CSS transitions. When the page becomes hidden, idle animations pause and resume on return. Reduced motion cancels idle and speech performance to identity and suppresses rapid mouth cycling. Page teardown cancels idle, body performance, scheduled speech, and lifecycle listeners.

## Fixed 50-interaction prologue

The prologue is one ordered list of 50 authored interactions. Placement of the current authored object changes the characters’ immediate response and persistent counters, then advances to the next interaction. Selecting an older unlocked object instead produces a short awareness-safe repeat reaction, records the reuse and target, and returns to the same authored interaction without changing `interaction_count`. It is state-based variation, not a `3^50` branching tree.

| Interactions | Communication level after the boundary | Character awareness |
|---|---:|---|
| 1–14 | 0 | Unaware of an observer. |
| 15–20 | 0 | Still unaware. Interaction 15 alone contains a vague notice that something has repeated. |
| 21–30 | 1 | Notice a pattern in object placement, not a person or intention. |
| 31–38 | 2 | Test whether the placement pattern may be intentional. |
| 39–43 | 3 | First restrained outward address; no response is demanded. |
| 44–46 | 4 | Three explicit placement tests. Compliance and refusal are both valid evidence and both continue. |
| 47–48 | 5 | Establish and test Otter = yes, middle = unsure, Whale = no. |
| 49 | 6 | Ask the explicit strawberry multiple-choice question. |
| 50 | 7 | Ask for a Unicode name, acknowledge it, and stop. |

Interaction 49 replaces spatial placement controls with three explicit answers mapped to the same positions: **Yes**, **Never tried one**, and **No**. Interaction 50 replaces them with the only free-text field in the prologue. A blank name does not advance. After a valid name is stored, the experience enters a terminal state and exposes no further interaction control.

The object drawer is hidden for interactions 49 and 50. Each interaction through 48 reveals its object in discovery order; repeated authored IDs resolve to the existing drawer entry rather than creating duplicates. The newest authored object is therefore always available, while earlier objects remain optional replay material.

## Authored behavior

Each interaction presents a named object, short setup beats, and placement outcomes. Physical acting reuses 11 cues: excited, hand-over, inspect, look-at-object, look-forward, pause, pick-up, put-down, share, suspicious, and toss. Actions last 2–8 seconds in normal motion. Dialogue remains concrete and appears near the active speaker; each displayed utterance contains one to three sentences. Reduced-motion mode shortens physical motion without changing the semantic result. Procedural voice duration is capped separately at four seconds, so sound cannot hold the authored sequence open indefinitely.

The characters do not infer a hidden ideology for Bailey. The three-placement tests never mark a choice wrong, penalize refusal, or require obedience. The first outward address occurs only at interaction 39.

## Persistent semantic state

State is browser-local JSON under a versioned storage envelope. It records semantic choices, never pointer trails, drawer scroll position, transient selection, or animation frames. Required state includes:

- completed interaction count and communication level `0..7`;
- Otter, middle, and Whale placement counters;
- sharing, autonomy, experimentation, automation, centralized-solution, and distributed-solution counters;
- complied-with-test and resisted-test counters;
- the first-apple, Whale-key, repeated-preference, frequent-middle, test-success, and test-refusal flags;
- strawberry preference;
- normalized Unicode name and whether the characters know it;
- bounded important-choice/event history and authored notable-event flags;
- older-object reuse count, last reused object, and last reuse placement without story advancement; and
- current and prior object IDs.

The runtime commits only completed semantic interactions. Reloading during presentation or animation returns to the last committed interaction. Invalid or unknown-version storage falls back to a clean initial state. If persistent storage is unavailable, the current page continues with volatile in-memory state; a reload then starts over. Persistence is limited to this browser and device; it does not imply identity, server backup, cross-device sync, or security beyond possession of the link.

## Accessibility and safety

Native radio inputs, buttons, the voice toggle, and the name field remain keyboard accessible even though there are no keyboard movement controls. Voice state is exposed through a labeled pressed-state control and audio is supplementary to written dialogue. Every drawer tile has a visible text label; selection, current-object status, and focus are not communicated by color alone. Spatial meaning is written in button labels rather than communicated by position or color alone. Dialogue has a polite live announcement, focus returns to the next relevant control, the name field accepts normalized Unicode, and user text is rendered as text rather than HTML.

The route remains absent from navigation and the sitemap and carries `noindex`, `nofollow`, `noarchive`, and `noimageindex`. Link possession is the only access boundary for now.

## Archived source concepts

`little-workshop-concept-source.txt` and `little-workshop-room-source.txt` remain preserved, hash-verified source notes. Their former semi-aquatic room, anchors, movement network, inventory, and expansion plan are archived future concepts, not current runtime claims. `WORLDVIEW.md` and `PYOTTER-MIKWHALE.md` continue to govern character behavior without overriding this smaller surface.

## Acceptance gate

The alpha is valid only when:

1. the authored data contains exactly interactions 1–50;
2. interactions 1–48 progressively unlock the horizontal object drawer, keep the center empty and placement actions hidden until selection, then expose all three placements;
3. awareness, tests, answer mapping, strawberry prompt, name prompt, and terminal stop occur at their exact boundaries;
4. current-object placement advances exactly once, while older-object reuse persists its event without advancing;
5. the state module restores the ordered sequence and required counters/flags;
6. the built page contains the flat stage and excludes room, movement, inventory management, crafting, network-AI, and keyboard-movement code;
7. voice playback remains explicit opt-in, local and procedural; Pyotter and Mikwhale retain distinct profiles, speech plans never exceed four seconds, and all end paths restore the mouth to rest;
8. each visible puppet keeps one untouched whole base image and exposes exactly 14 nested articulated overlay roles plus two synchronized opacity-driven eyelids;
9. both characters expose exactly 50 unique deterministic 20-second articulated idle variants with identity endpoints and independent chaining, while the whole-rig compatibility track remains at identity;
10. deterministic speech performance uses the nested part layers, never the base portrait or mouth, and coordinates no more than nine active tracks without per-frame JavaScript;
11. visibility and reduced-motion lifecycle changes pause, cancel, restore, or resume presentation without changing semantic state; and
12. the unlisted route builds without entering the sitemap or public navigation.

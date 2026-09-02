# Pyotter project doctrine

This document governs product, interaction, animation, persistence, and technical decisions for Pyotter. `PERSONA.md` governs characterization but cannot override this product doctrine. The user's exact 100-point source is preserved verbatim in `philosophy-source.txt`.

## North star

**Pyotter should feel like a tiny friend who remembers, not a game that resets.**

Attachment must come from continuity, personality, shared history, and a world shaped together. It must not come from points, scarcity, punishment, surveillance, or artificial difficulty leaving.

## Priority rules

When principles compete, use this order:

1. Explicit user choice beats inference.
2. Continuity beats novelty.
3. Stable spatial familiarity beats adaptive rearrangement.
4. Reversibility beats confirmation friction.
5. Concrete shared history beats abstract rewards.
6. Useful discovery beats random decoration.
7. Accessibility preferences beat surprise or spectacle.
8. User sovereignty and portability beat lock-in.

## Twelve pillars

### 1. Immediate reunion

Open directly into Pyotter's current world. Restore his location, facing direction, safe semantic action, nearby objects, camera, zoom, and unfinished activity. Do not interpose a dashboard. The first useful interaction must be available immediately.

Restore meaning rather than freezing an animation mid-frame. Pyotter resumes naturally near the prior activity, then performs a brief, consistent hello ritual.

### 2. Frictionless agency

The dominant action is direct interaction with Pyotter or his world. Click, tap, drag, swipe, gesture, and keyboard controls remain simple. Reversible actions happen immediately; destructive actions move to recoverable trash.

Expert gestures may become faster, but basic controls never become obsolete.

### 3. A familiar home with rituals

Major places and controls remain spatially stable. Objects stay where they were placed. Pyotter has recognizable entry and exit rituals. The habitat can gain friend-specific details, but personalization must not make the world feel rearranged behind the user's back.

### 4. Embodied cause and effect

Every meaningful input produces immediate visible feedback through eyes, ears, paws, posture, tail, water, objects, motion, or restrained sound. Feedback strength reflects importance. Longer operations show progressive causal feedback. Dead clicks and ambiguous states are bugs.

### 5. Concrete progress across time

Progress exists on three timescales:

- Short: something satisfying happened this session.
- Medium: a routine, arrangement, relationship, or unfinished project developed across sessions.
- Long: the habitat and its objects gained visible history over months or years.

Show concrete facts and artifacts, never generic XP. A worn favorite book, a remembered arrangement, or a completed communal raft matters; “1,400 points” does not.

### 6. Durable relational memory

Remember explicit preferences, favorite interactions, named objects, object locations, unfinished threads, discoveries, and meaningful relationships. Never ask the user to repeatedly teach something already learned.

Collect semantic events, not raw pointer surveillance. Remember only what makes the experience more continuous or personally meaningful.

### 7. Stable, controllable adaptation

Adapt Pyotter's suggestions, defaults, timing, and responses gradually. Never move established controls during a session. Explicit preferences override inferred ones. Inferences require repeated evidence, remain visible and explainable, and can be reset individually.

Sound is explicit opt-in. Motion respects system preference and a direct reduced-motion control.

### 8. A persistent world with patina

Objects occupy remembered places and acquire history. Frequently handled objects may become visually distinct. Half-finished activities remain visible. Abandoned objects become rediscoverable rather than silently disappearing.

Provide stable homes and an archive so persistence creates familiarity rather than clutter.

### 9. Layered discovery and private lore

Reveal depth only when relevant behavior appears. Hidden interactions reward meaningful experimentation, not random clicking. Rare events arise from genuine milestones and remain subtle enough to feel discovered.

The friend's exact phrase **“read the bread book”** is reserved as private lore tied to Kropotkin's *The Conquest of Bread*. It must be a discoverable interaction, not constant branding or a random reward.

Secrets may add delight but never gate essential controls or accessibility.

### 10. Honest unfinishedness

Pyotter may leave a structure unfinished, bookmark a book, or pause play for later. Returning should surface a promising thread without guilt, decay, punishment, fake timers, artificial cliffhangers, or loss for being absent.

End sessions with a calm sense of what remains possible.

### 11. Expressive mastery

Novices receive simple direct controls. Experts gain expressive gesture sequences, object combinations, movement cues, routines, and shortcuts. Thousands of outcomes come compositionally from:

```text
verb × direction × pose × mood × object × environment × history
```

This is why Pyotter is a layered puppet rather than thousands of unrelated rendered clips.

### 12. Earned attachment and sovereignty

Pyotter becomes difficult to replace because he contains shared history and accumulated understanding—not because leaving is obstructed. Everything meaningful must eventually be exportable, importable, resettable, and deletable.

Pyotter is a companion with agency and personality, not property trained for obedience.

## Non-negotiable exclusions

Do not add:

- currency, shops, ads, purchases, loot boxes, or monetized scarcity;
- XP, leaderboards, productivity quotas, streak loss, or absence punishment;
- variable-ratio rewards, FOMO, fake urgency, or arbitrary waiting;
- irreversible deletion without a separate explicit purge;
- interface rearrangement disguised as personalization;
- hidden behavioral tracking or unexplained inference;
- essential interactions available only through secrets, sound, or motion;
- a dashboard before the living world;
- social pressure as a substitute for curiosity;
- claims of privacy, sync, recovery, or learning that the implementation cannot support.

## Persistence contract

The first static version should be local-first:

- Native IndexedDB is the source of truth.
- `localStorage` may hold only a tiny boot hint such as the latest snapshot revision.
- Save meaningful actions transactionally.
- Checkpoint on visibility changes and page hiding; do not rely on unload.
- Maintain a current snapshot, semantic event history, session summaries, recoverable trash, and migration/import backups.
- Preserve undo and redo across reloads where practical.
- Use versioned schemas and migrate a validated copy before replacement.
- Request persistent browser storage only after a user gesture and never imply that the browser guarantees it.

The minimum conceptual state includes:

```text
installation identity and world seed
Pyotter action, direction, mood, energy, appearance, and relationships
persistent objects, placements, history, and unfinished threads
camera, zoom, active object, open panel, and safe resume checkpoint
explicit preferences and cautious inferred defaults
concrete discoveries, milestones, first/last dates, and interaction history
```

Exports should be documented, human-readable JSON produced entirely in the browser. Import validates and migrates a copy, previews consequences, creates a pre-import backup, then merges or replaces atomically. “Export everything” and “Delete all local data” belong together.

## Honest first-version limits

Without authentication or a backend, do not promise:

- friend-only privacy;
- state following the link to another browser or device;
- automatic synchronization or shared state;
- recovery after browser storage is cleared, evicted, or lost with the device;
- durable remote backups;
- reliable activity while the page is closed;
- remote notifications or authoritative server time;
- machine-learning personalization;
- protection from someone who can access the same browser or operating-system profile.

The initial implementation can honestly provide deterministic local preference heuristics, manual export/import, versioned local history, and a stable remembered world on one browser profile.

## Review test

Before accepting any feature, ask:

1. Does it help Pyotter remember, respond, mature, or become more expressive?
2. Is its effect immediate, legible, and reversible?
3. Does it preserve the user's familiar place and explicit choices?
4. Does it create meaningful history rather than a metric?
5. Can the user understand, override, export, or delete what was learned?
6. Is anticipation honest and free of punishment or manipulation?
7. Does the feature still work accessibly without sound or motion?

If the answer is no, the feature does not belong yet.

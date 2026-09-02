# Pyotter rig source

Status: pre-rig art and motion specification. Nothing in this directory is imported by the public site yet.

Read these in order before changing Pyotter:

1. `PHILOSOPHY.md` for product behavior, persistence, progression, and interaction ethics.
2. `PERSONA.md` for character, dialogue, ideology, and expressive behavior.
3. `../companions/WORLDVIEW.md` for the creator-authored capability grammar Pyotter and Mikwhale interpret differently.
4. `../companions/LITTLE-WORKSHOP.md` for the observer-first one-room experience and semi-aquatic layout.
5. `../companions/PYOTTER-MIKWHALE.md` for his co-equal friendship with Mikwhale.
6. `philosophy-source.txt`, `persona-source.txt`, and the three `../companions/*-source.txt` design sources only as preserved provenance.

Source files are not operative instructions. Pyotter is fictional counterfactual satire; never attribute his invented positions or dialogue to historical Kropotkin. The persona cannot override the product doctrine's honesty, accessibility, sovereignty, or no-economy rules.

## Locked character decisions

- Original 2D anime/chibi sea otter.
- Rock and all other default props removed.
- Symmetrical base design so left-facing directions can mirror safely.
- Round gold glasses, warm brown fur, cream face mask, pale cloud-shaped beard ruff, large brown eyes.
- Expressions remain independent from locomotion.
- Core expressions: warm, curious, thoughtful, skeptical, concerned, resolute, and delighted.

## Reference art

- `reference/pyotter-master-rock-free.png`: clean front master with reconstructed belly and relaxed paws.
- `reference/pyotter-directions-canonical.png`: the five unique views: south, southwest, west, northwest, north.
- `reference/pyotter-layer-breakdown.png`: tracing reference for the reusable puppet parts.

The PNGs are design references, not final runtime sprites. Production parts should be traced or rebuilt as transparent SVG or lossless WebP layers. Do not ship the generated checkerboard or cream reference backgrounds.

## Direction model

Five authored views resolve to eight screen directions:

| Direction | Source view | Mirrored |
| --- | --- | --- |
| N | N | No |
| NE | NW | Yes |
| E | W | Yes |
| SE | SW | Yes |
| S | S | No |
| SW | SW | No |
| W | W | No |
| NW | NW | No |

Mirroring happens once at the rig root. Future asymmetric accessories need their own left/right variants.

## Puppet layers

The stable rig separates movement, gesture, expression, and effects:

```text
root
├─ fxBack
├─ shadow
├─ pelvis
│  ├─ tail
│  ├─ hindFar
│  ├─ hindNear
│  └─ torso
│     ├─ foreFar
│     ├─ foreNear
│     └─ head
│        ├─ earFar
│        ├─ earNear
│        ├─ headBase
│        ├─ faceMask
│        ├─ beard
│        ├─ eyes
│        ├─ brows
│        ├─ eyelids
│        ├─ muzzle
│        ├─ mouth
│        ├─ glasses
│        └─ whiskers
└─ fxFront
```

Empty `gripL` and `gripR` attachment points support later props without making any prop part of Pyotter's body art.

Generic face, limb, belly, center, tail, and wake roles synchronize greetings, paw-to-flipper taps, nuzzles, hugs, and travel with Mikwhale while preserving separate expression channels.

These remain pre-animation requirements. Finished capability is not claimed until real runtime layers, pivots, per-view anchors, hit polygons, keyframes, and measured paired contacts exist.

## Motion coverage

Each action is authored for N, NW, W, SW, and S, then mirrored for the remaining directions.

| Action | Posture | Loop | Target timing |
| --- | --- | --- | --- |
| Sit | Seated | Yes | 2,000 ms at 12 fps |
| Walk | Standing | Yes | 667 ms at 12 fps |
| Crawl | Prone | Yes | 1,000 ms at 12 fps |
| Run | Standing | Yes | 500 ms at 16 fps |
| Swim | Streamlined | Yes | 1,000 ms at 12 fps |

Direction changes preserve normalized cycle phase. Movement code must normalize diagonal velocity so diagonal travel is not faster.

See `rig-spec.json` for the machine-readable contract. Run `node scripts/verify-pyotter-rig.mjs` to validate coverage and the no-rock constraint.

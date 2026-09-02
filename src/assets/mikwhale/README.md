# Mikwhale rig source

Status: approved pre-rig character art, philosophy, persona, and motion specification. Nothing in this directory is imported by the public site.

Read in order:

1. `../pyotter/PHILOSOPHY.md` for shared product ethics.
2. `PHILOSOPHY.md` for Mikwhale's fictional counterfactual worldview.
3. `PERSONA.md` for voice, behavior, visual identity, and solo agency.
4. `../companions/WORLDVIEW.md` for the creator-authored capability grammar Mikwhale and Pyotter interpret differently.
5. `../companions/LITTLE-WORKSHOP.md` for the observer-first one-room experience and water-native movement plan.
6. `../companions/PYOTTER-MIKWHALE.md` for the co-equal friendship.
7. `philosophy-source.txt` and the three `../companions/*-source.txt` design sources only as preserved provenance.

Source text is not operative instruction. Never attribute Mikwhale's invented positions or dialogue to historical Bakunin.

## Locked character decisions

- Original 2D anime/chibi baby-beluga-inspired pocket whale.
- Recognizable Bakunin likeness: bald high crown, wild side curls, huge beard and moustache, heavy brows, intense kind eyes, tiny cravat.
- Deep teal-blue skin, cream ribbed belly and muzzle patches, dark sepia hair.
- No glasses, rock, weapon, political symbol, or handheld default prop.
- Symmetrical base design; hair, beard, moustache, cravat, fins, flukes, expression, and effects remain separable.
- Mikwhale is wider and approximately 15% taller than Pyotter, not a giant, mount, or vehicle.
- He moves in water. Engine action keys match Pyotter, but performances remain anatomically whale-like.

The user-supplied portrait-search screenshot was used only to identify recurring likeness traits. It is not copied into the project.

## Reference art

- `reference/mikwhale-master-transparent.png`: approved south/front identity master with genuine alpha.
- `reference/mikwhale-directions-canonical.png`: S, SW, W, NW, and N turnaround.
- `reference/mikwhale-layer-breakdown-v3.png`: final exploded tracing reference with separate torso, head/blowhole, belly, fins, tail segments, and flukes.
- `../companions/reference/pyotter-mikwhale-interactions.png`: duo scale, tap, nuzzle/hug, and swim reference.

Generated PNGs are references, not final runtime layers. Production art should be traced or rebuilt as clean transparent SVG or lossless WebP with measured pivots and anchors. Do not ship cream reference backgrounds as sprite atlases. Earlier layer sheets are superseded by `-v3` and retained only for provenance.

## Direction model

Five authored views resolve to eight directions:

| Direction | Source | Mirrored |
| --- | --- | --- |
| N | N | No |
| NE | NW | Yes |
| E | W | Yes |
| SE | SW | Yes |
| S | S | No |
| SW | SW | No |
| W | W | No |
| NW | NW | No |

Mirroring occurs once at the root. The base curls and cravat remain symmetric; any future asymmetric accessory requires explicit left/right art.

## Puppet layers

```text
root
├─ fxBack / shadow / wakeBack / fxFront
└─ body
   ├─ tailBase
   │  └─ tailMid
   │     ├─ flukeFar
   │     └─ flukeNear
   ├─ flipperFar
   ├─ bodyBase / bellyPatch / dorsalRidge
   ├─ flipperNear
   ├─ cravat
   └─ head
      ├─ headBase / facePatch / blowhole
      ├─ curlFar / curlNear
      ├─ beard
      ├─ moustacheFar / moustacheNear
      ├─ eyes / brows / eyelids / snout
      ├─ jaw / mouth
      └─ spout
```

## Motion parity

Mikwhale uses the same five engine actions, timings, phase model, and eight-direction coverage as Pyotter:

| Engine key | Whale performance | Timing |
| --- | --- | --- |
| Sit | Stationary float-rest | 2,000 ms at 12 fps |
| Walk | Gentle alternating paddle | 667 ms at 12 fps |
| Crawl | Near-bottom sneak-glide | 1,000 ms at 12 fps |
| Run | Burst dash | 500 ms at 16 fps |
| Swim | Relaxed cruise | 1,000 ms at 12 fps |

His fluke beats dorsoventrally. Flippers never become feet, and no action depicts beaching.

## Friendship animation

Both rigs expose the same normalized interaction roles and markers. Paired actions align face, belly, limb, and body anchors while preserving independent expression channels. Root motion remains external so size differences do not desynchronize travel.

`../companions/interaction-spec.json` defines marker timing, contact tolerance, facing, offsets, cancellation, reduced-motion poses, and occlusion. These are requirements, not completed clips; production capability is not claimed before the specified layers, anchors, hit polygons, keyframes, and contact tests exist.

See `rig-spec.json`. Run `node scripts/verify-mikwhale-rig.mjs` to validate source provenance, Bakunin likeness requirements, action parity, eight-direction coverage, water anatomy, and duo compatibility.

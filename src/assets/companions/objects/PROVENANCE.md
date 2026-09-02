# Little Workshop object-art provenance

Mode: built-in ImageGen, followed by deterministic local alpha cleanup, trimming, and padding with `scripts/build-workshop-object-sprites.mjs`.

## Saved project assets

- Selected cleaned atlas: `source/object-atlas-magenta-v1.png`
- Runtime sprites: `apple-v1.png`, `ball-v1.png`, `battery-v1.png`, `bell-v1.png`, `block-v1.png`, `book-v1.png`, `box-v1.png`, `coin-v1.png`, `cookie-v1.png`, `cup-v1.png`, `flower-v1.png`, `hammer-v1.png`, `key-v1.png`, `lamp-v1.png`, `magnet-v1.png`, `paper-v1.png`, `pencil-v1.png`, `robot-v1.png`, `seed-v1.png`, `string-v1.png`
- Separate runtime sprite: `strawberry-v1.png`

## Exact prompt set

Initial atlas generation:

```text
Use case: production game asset atlas. Create exactly twenty small 2D chibi object sprites matching the polished anime/chibi illustration language, warm palette, crisp dark outline, and clean shading of the two referenced companion characters. Objects: red apple, small red ball, yellow wildflower with green stem, cream cup, closed teal book, round cookie, yellow pencil, one white paper sheet, small wooden block, coiled red string, brass key, copper coin, sprouting seed, small cardboard box, tiny hammer, compact battery, warm table lamp, horseshoe magnet, brass hand bell, tiny friendly repair robot. Composition: five columns by four rows, one object centered in each generous cell, consistent apparent scale, every object fully visible, separated by large transparent gaps, no overlap. Genuine transparent RGBA background. No labels, no numbers, no text, no characters, no hands, no scenery, no shadows outside each sprite, no frame, no checkerboard. Preserve mechanically sensible forms, sharp antialiased edges, coherent materials, no blur, no malformed details, no duplicate objects, no extra objects. Atlas should be easy to segment into twenty individual transparent PNGs.
```

Selected atlas cleanup edit:

```text
Use case: precise production cleanup. Preserve every one of the twenty object sprites exactly as shown: same forms, positions, scale, color, shading, outline, five-column by four-row layout, and no additions or deletions. Make ONE change only: replace the entire gray-and-white checkerboard background with a perfectly flat, uniform, solid pure chroma-magenta background color #FF00FF. No gradient, no texture, no shadow, no checker pattern, no white border. Keep all objects fully visible and separated. Output one atlas.
```

Strawberry generation:

```text
Use case: production game asset. Create one single ripe strawberry sprite matching the exact chibi object style, crisp dark outline, warm shading, scale, and finish of the referenced object atlas. Center the complete strawberry with green leafy cap and no face on a perfectly flat uniform pure chroma-magenta #FF00FF background. No texture, no checkerboard, no shadow outside the fruit, no text, no border, no extra objects, no characters. Keep generous empty magenta space around it.
```

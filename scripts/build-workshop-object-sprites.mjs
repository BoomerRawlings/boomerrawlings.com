import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(
  projectRoot,
  'src/assets/companions/objects/source/object-atlas-magenta-v1.png',
);
const outputDirectory = path.join(projectRoot, 'src/assets/companions/objects');
const objectNames = [
  'apple',
  'ball',
  'flower',
  'cup',
  'book',
  'cookie',
  'pencil',
  'paper',
  'block',
  'string',
  'key',
  'coin',
  'seed',
  'box',
  'hammer',
  'battery',
  'lamp',
  'magnet',
  'bell',
  'robot',
];

const atlas = sharp(sourcePath).ensureAlpha();
const { data, info } = await atlas.raw().toBuffer({ resolveWithObject: true });

const sampleCorner = (left, top, width, height, cornerX, cornerY) => {
  const sampleSize = 18;
  const startX = cornerX === 0 ? left + 2 : left + width - sampleSize - 2;
  const startY = cornerY === 0 ? top + 2 : top + height - sampleSize - 2;
  const total = [0, 0, 0];
  let count = 0;
  for (let y = startY; y < startY + sampleSize; y += 1) {
    for (let x = startX; x < startX + sampleSize; x += 1) {
      const offset = (y * info.width + x) * 4;
      total[0] += data[offset];
      total[1] += data[offset + 1];
      total[2] += data[offset + 2];
      count += 1;
    }
  }
  return total.map((channel) => channel / count);
};

const mix = (a, b, progress) => a + (b - a) * progress;

await mkdir(outputDirectory, { recursive: true });

for (let index = 0; index < objectNames.length; index += 1) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  const left = Math.round((column * info.width) / 5);
  const right = Math.round(((column + 1) * info.width) / 5);
  const top = Math.round((row * info.height) / 4);
  const bottom = Math.round(((row + 1) * info.height) / 4);
  const width = right - left;
  const height = bottom - top;
  const corners = [
    sampleCorner(left, top, width, height, 0, 0),
    sampleCorner(left, top, width, height, 1, 0),
    sampleCorner(left, top, width, height, 0, 1),
    sampleCorner(left, top, width, height, 1, 1),
  ];
  const cell = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const py = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const px = x / Math.max(1, width - 1);
      const sourceOffset = ((top + y) * info.width + left + x) * 4;
      const targetOffset = (y * width + x) * 4;
      const background = [0, 1, 2].map((channel) =>
        mix(
          mix(corners[0][channel], corners[1][channel], px),
          mix(corners[2][channel], corners[3][channel], px),
          py,
        ),
      );
      const red = data[sourceOffset];
      const green = data[sourceOffset + 1];
      const blue = data[sourceOffset + 2];
      const redRatio = red / Math.max(1, background[0]);
      const blueRatio = blue / Math.max(1, background[2]);
      const chromaLike =
        Math.abs(redRatio - blueRatio) < 0.16 &&
        green < Math.max(62, background[1] + 24) &&
        red > green * 2.4 &&
        blue > green * 2.1;

      let alpha = 1;
      if (chromaLike) {
        const backgroundShare = Math.min(1, Math.max(0, (redRatio + blueRatio) / 2));
        alpha = 1 - backgroundShare;
        if (alpha < 0.075) alpha = 0;
        else if (alpha > 0.88) alpha = 1;
      }

      if (alpha === 0) continue;
      const recover = (channel, value) => {
        if (alpha === 1) return value;
        return Math.max(
          0,
          Math.min(255, Math.round((value - (1 - alpha) * background[channel]) / alpha)),
        );
      };
      cell[targetOffset] = recover(0, red);
      cell[targetOffset + 1] = recover(1, green);
      cell[targetOffset + 2] = recover(2, blue);
      cell[targetOffset + 3] = Math.round(alpha * 255);
    }
  }

  const trimmed = await sharp(cell, { raw: { width, height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  const side = Math.max(trimmed.info.width, trimmed.info.height) + 24;
  await sharp(trimmed.data)
    .extend({
      top: Math.floor((side - trimmed.info.height) / 2),
      bottom: Math.ceil((side - trimmed.info.height) / 2),
      left: Math.floor((side - trimmed.info.width) / 2),
      right: Math.ceil((side - trimmed.info.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDirectory, `${objectNames[index]}-v1.png`));
}

console.log(`Built ${objectNames.length} transparent workshop object sprites.`);

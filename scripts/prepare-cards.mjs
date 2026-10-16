// Run with the Sharp version installed with Next.js. Generated assets are checked
// in, so serving the game never rasterizes a court card during an animation.
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'public/cards/SVG-cards-1.3');
const output = path.join(root, 'public/cards/optimized');
await mkdir(output, { recursive: true });
const ranks = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
let sourceBytes = 0,
  outputBytes = 0;
for (const rank of ranks) {
  await Promise.all(
    ['clubs', 'diamonds', 'hearts', 'spades'].map(async (suit) => {
      const name = `${rank}_of_${suit}${['jack', 'queen', 'king'].includes(rank) ? '2' : ''}`;
      const input = path.join(source, `${name}.svg`);
      const target = path.join(output, `${name}.webp`);
      await sharp(input, { density: 192 })
        .resize(334, 486, { fit: 'fill' })
        .webp({ lossless: true, effort: 6 })
        .toFile(target);
      const [original, optimized] = await Promise.all([stat(input), stat(target)]);
      sourceBytes += original.size;
      outputBytes += optimized.size;
    }),
  );
}
console.log(
  `52 card faces: ${(sourceBytes / 1024).toFixed(0)} KB SVG → ${(outputBytes / 1024).toFixed(0)} KB lossless WebP. Original SVG files retained.`,
);

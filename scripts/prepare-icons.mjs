import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = await readFile(new URL('../public/art/cabo-icon-source.png', import.meta.url));
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).ensureAlpha().png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await Promise.all([
  writeFile(new URL('../app/favicon.ico', import.meta.url), Buffer.concat([header, ...images])),
  sharp(source)
    .resize(512, 512)
    .png()
    .toFile(fileURLToPath(new URL('../app/icon.png', import.meta.url))),
  sharp(source)
    .resize(180, 180)
    .png()
    .toFile(fileURLToPath(new URL('../app/apple-icon.png', import.meta.url))),
]);
console.log('Prepared 16/32/48px favicon, 512px app icon, and 180px Apple icon.');

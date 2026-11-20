// Единственный источник иконок — public/icon.svg (1024×1024, квадрат без скруглений).
// Скрипт нарезает из него все PNG/SVG. Запуск: npm run icons
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SRC = path.join(PUB, 'icon.svg');
const R = 232; // радиус скругления для favicon в стиле iOS

const src = fs.readFileSync(SRC, 'utf8');
const bg = (src.match(/<rect[^>]*fill="(#[0-9A-Fa-f]{3,8})"/) || [])[1] || '#060D18';

// Внутренности icon.svg — чтобы собрать скруглённый favicon, не дублируя рисунок.
const inner = src
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <clipPath id="squircle"><rect width="1024" height="1024" rx="${R}" ry="${R}"/></clipPath>
  </defs>
  <g clip-path="url(#squircle)">${inner}</g>
</svg>
`;

function report(file) {
  const { size } = fs.statSync(file);
  console.log(`ok  ${path.relative(ROOT, file)}  ${(size / 1024).toFixed(1)} KB`);
}

async function render(svgBuffer, size, out) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  report(out);
}

// Maskable: знак ужимается до безопасной зоны (80%), фон остаётся на весь квадрат.
async function renderMaskable(size, out) {
  const safe = Math.round(size * 0.8);
  const glyph = await sharp(Buffer.from(src), { density: 384 })
    .resize(safe, safe)
    .png()
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: glyph, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  report(out);
}

fs.writeFileSync(path.join(PUB, 'favicon.svg'), favicon);
report(path.join(PUB, 'favicon.svg'));

// Apple: строгий квадрат без скруглений — маску iOS накладывает сама.
for (const s of [120, 152, 167, 180]) {
  await render(Buffer.from(src), s, path.join(PUB, `apple-touch-icon-${s}.png`));
}

await render(Buffer.from(src), 192, path.join(PUB, 'icon-192.png'));
await render(Buffer.from(src), 512, path.join(PUB, 'icon-512.png'));
await render(Buffer.from(src), 1024, path.join(PUB, 'icon-1024.png'));
await renderMaskable(512, path.join(PUB, 'icon-maskable-512.png'));

console.log('done');

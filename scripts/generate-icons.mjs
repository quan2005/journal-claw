import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'src-tauri', 'icons');
const ICONSET_DIR = join(ICONS_DIR, 'icon.iconset');

const COLOR = '#C8933B';
const BG = '#0f0f0f';
const VB = 320;
const FONT_SIZE = 260;
const LINE_GAP = 16;
const LINE_START = 6;

function lines(strokeWidth) {
  let result = '';
  for (let y = LINE_START; y <= VB; y += LINE_GAP) {
    result += `<line x1="0" y1="${y}" x2="${VB}" y2="${y}" stroke="${COLOR}" stroke-width="${strokeWidth}"/>`;
  }
  return result;
}

function dot(show) {
  if (!show) return '';
  return `
    <circle cx="220" cy="225" r="13" fill="${COLOR}" opacity="0.18"/>
    <circle cx="220" cy="225" r="6.5" fill="${COLOR}"/>`;
}

function makeSvg(size, strokeWidth, showDot) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VB} ${VB}">
  <rect width="${VB}" height="${VB}" fill="${BG}"/>
  <defs>
    <clipPath id="c">
      <text x="${VB/2}" y="${VB/2}" text-anchor="middle" dominant-baseline="central"
            font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui" font-weight="700" font-size="${FONT_SIZE}">謹</text>
    </clipPath>
  </defs>
  <g clip-path="url(#c)">
    ${lines(strokeWidth)}
  </g>
  ${dot(showDot)}
</svg>`;
}

const sizes = [
  ['icon.png', 512, 3.5, true],
  ['128x128@2x.png', 256, 4, true],
  ['128x128.png', 128, 4.5, true],
  ['32x32@2x.png', 64, 5, true],
  ['32x32.png', 32, 7, false],
];

const storeSizes = [
  ['Square310x310Logo.png', 310, 3.5, true],
  ['Square284x284Logo.png', 284, 3.5, true],
  ['Square150x150Logo.png', 150, 4.5, true],
  ['Square142x142Logo.png', 142, 4.5, true],
  ['Square107x107Logo.png', 107, 5, true],
  ['Square89x89Logo.png', 89, 5, true],
  ['Square71x71Logo.png', 71, 5, true],
  ['Square44x44Logo.png', 44, 5.5, true],
  ['Square30x30Logo.png', 30, 7, false],
  ['StoreLogo.png', 50, 5.5, true],
];

function renderPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: true },
  });
  return resvg.render().asPng();
}

console.log('Generating icon PNGs...');
for (const [name, size, sw, showDot] of [...sizes, ...storeSizes]) {
  const svg = makeSvg(size, sw, showDot);
  const png = renderPng(svg, size);
  writeFileSync(join(ICONS_DIR, name), png);
  console.log(`  ${name} (${size}x${size})`);
}

console.log('\nGenerating icon.icns...');
if (!existsSync(ICONSET_DIR)) mkdirSync(ICONSET_DIR);

const icnsMap = [
  ['icon_16x16.png', 16, 8, false],
  ['icon_16x16@2x.png', 32, 7, false],
  ['icon_32x32.png', 32, 7, false],
  ['icon_32x32@2x.png', 64, 5, true],
  ['icon_128x128.png', 128, 4.5, true],
  ['icon_128x128@2x.png', 256, 4, true],
  ['icon_256x256.png', 256, 4, true],
  ['icon_256x256@2x.png', 512, 3.5, true],
  ['icon_512x512.png', 512, 3.5, true],
  ['icon_512x512@2x.png', 1024, 3, true],
];

for (const [name, size, sw, showDot] of icnsMap) {
  const svg = makeSvg(size, sw, showDot);
  const png = renderPng(svg, size);
  writeFileSync(join(ICONSET_DIR, name), png);
}

execFileSync('iconutil', ['-c', 'icns', ICONSET_DIR, '-o', join(ICONS_DIR, 'icon.icns')]);
rmSync(ICONSET_DIR, { recursive: true });
console.log('  icon.icns generated');

console.log('\nGenerating icon.ico...');

function buildIco(pngBuffers, icoSizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const s = icoSizes[i];
    entry.writeUInt8(s >= 256 ? 0 : s, 0);
    entry.writeUInt8(s >= 256 ? 0 : s, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngBuffers[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += pngBuffers[i].length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

const icoConfigs = [
  [32, 7, false],
  [64, 5, true],
  [128, 4.5, true],
  [256, 4, true],
];

const icoPngs = icoConfigs.map(([size, sw, showDot]) =>
  renderPng(makeSvg(size, sw, showDot), size)
);

writeFileSync(
  join(ICONS_DIR, 'icon.ico'),
  buildIco(icoPngs, icoConfigs.map(c => c[0]))
);
console.log('  icon.ico generated');

console.log('\nDone! All icons generated in src-tauri/icons/');

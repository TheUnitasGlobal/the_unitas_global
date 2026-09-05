// One-shot favicon.ico generator: rasterizes public/assets/svg/unitas-mark.svg
// at the standard multi-resolution favicon sizes (16/32/48/64/128/256) via the
// same headless-Edge screenshot technique as generate-icons.mjs (zero new
// node_modules deps, per Low-Memory Armor), then packs the resulting PNGs
// into a single ICO container by hand (PNG-compressed ICO frames, supported
// by every browser since IE9/Vista -- no need for legacy raw-BMP-DIB frames).
// Re-run this any time unitas-mark.svg's artwork changes.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const webRoot = join(__dirname, '..');
const svgPath = join(webRoot, 'public/assets/svg/unitas-mark.svg');
const outPath = join(webRoot, 'public/favicon.ico');
const svgMarkup = readFileSync(svgPath, 'utf8');

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const edgePath = EDGE_CANDIDATES.find((p) => {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
});
if (!edgePath) {
  throw new Error('msedge.exe not found -- cannot rasterize the favicon without a headless browser.');
}

const BG = '#030305';
const LOGO_FRAC = 0.78;
const SIZES = [16, 32, 48, 64, 128, 256];

function packIco(frames) {
  const headerSize = 6 + 16 * frames.length;
  const dataStart = headerSize;
  let offset = dataStart;
  const entries = [];
  const chunks = [];
  for (const { size, png } of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count (n/a, 32bpp)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    entries.push(entry);
    chunks.push(png);
    offset += png.length;
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4); // image count
  return Buffer.concat([header, ...entries, ...chunks]);
}

const workDir = mkdtempSync(join(tmpdir(), 'unitas-favicon-'));

try {
  const frames = [];
  for (const size of SIZES) {
    const logoSize = Math.round(size * LOGO_FRAC);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${BG};overflow:hidden;}
      .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${BG};}
      .wrap svg{width:${logoSize}px;height:${logoSize}px;display:block;}
    </style></head><body><div class="wrap">${svgMarkup}</div></body></html>`;

    const htmlPath = join(workDir, `${size}.html`);
    const pngPath = join(workDir, `${size}.png`);
    writeFileSync(htmlPath, html, 'utf8');

    execFileSync(
      edgePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        `--window-size=${size},${size}`,
        `--screenshot=${pngPath}`,
        `file:///${htmlPath.replace(/\\/g, '/')}`,
      ],
      { stdio: 'inherit' },
    );

    frames.push({ size, png: readFileSync(pngPath) });
  }

  writeFileSync(outPath, packIco(frames));
  console.log(`Generated favicon.ico (${SIZES.join('/')}) at ${outPath}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

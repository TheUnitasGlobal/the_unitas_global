// One-shot PWA icon generator: rasterizes public/assets/svg/unitas-mark.svg
// into public/icons/*.png via headless Edge (already installed on this
// machine) instead of adding a native rasterization dependency (sharp,
// resvg, canvas, ...) -- keeps node_modules footprint at zero per the
// Low-Memory Armor guidance in CLAUDE.md. Re-run this script any time
// unitas-mark.svg's artwork changes.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const webRoot = join(__dirname, '..');
const svgPath = join(webRoot, 'public/assets/svg/unitas-mark.svg');
const iconsDir = join(webRoot, 'public/icons');
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
  throw new Error('msedge.exe not found -- cannot rasterize icons without a headless browser.');
}

const BG = '#030305';

const targets = [
  { name: 'icon-192.png', size: 192, logoFrac: 0.78, bg: BG },
  { name: 'icon-512.png', size: 512, logoFrac: 0.78, bg: BG },
  // Maskable: OS may crop to a circle, so artwork must sit inside the
  // center ~80%-diameter safe zone -- use a smaller logo fraction and an
  // edge-to-edge opaque background (maskable icons must never be transparent).
  { name: 'icon-maskable-512.png', size: 512, logoFrac: 0.55, bg: BG },
  // Apple touch icons ignore alpha (renders black-on-transparent), so this
  // must also be a fully opaque square.
  { name: 'apple-touch-icon.png', size: 180, logoFrac: 0.76, bg: BG },
  { name: 'shortcut-192.png', size: 192, logoFrac: 0.78, bg: BG },
];

const workDir = mkdtempSync(join(tmpdir(), 'unitas-icons-'));

try {
  for (const { name, size, logoFrac, bg } of targets) {
    const logoSize = Math.round(size * logoFrac);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${bg};overflow:hidden;}
      .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg};}
      .wrap svg{width:${logoSize}px;height:${logoSize}px;display:block;}
    </style></head><body><div class="wrap">${svgMarkup}</div></body></html>`;

    const htmlPath = join(workDir, name.replace('.png', '.html'));
    const outPath = join(iconsDir, name);
    writeFileSync(htmlPath, html, 'utf8');

    execFileSync(
      edgePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        `--window-size=${size},${size}`,
        `--screenshot=${outPath}`,
        `file:///${htmlPath.replace(/\\/g, '/')}`,
      ],
      { stdio: 'inherit' },
    );
  }
  console.log(`Generated ${targets.length} icons into ${iconsDir}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

// Build per-node image assets: apply Figma's CROP transform, then resample to 2x display size.
// Assets are keyed by (imageRef + crop + display box) because the same fill is reused at
// different crops (e5736e32 and 45de36d2 each appear twice with different transforms).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = "C:\\Users\\Howin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe');
const DPR = 2, QUALITY = 82;

const srcDir = path.join(__dirname, 'assets');
const outDir = path.join(__dirname, 'assets-opt');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'figma-node.json'), 'utf8'));
const root = raw.nodes[Object.keys(raw.nodes)[0]].document;

// imageRef -> downloaded original filename
const originals = {};
fs.readdirSync(srcDir).forEach(f => { originals[f.split('.')[0]] = f; });

const probeCache = {};
const probe = file => {
  if (!probeCache[file]) {
    const j = JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'json', path.join(srcDir, file)]).toString());
    probeCache[file] = { w: j.streams[0].width, h: j.streams[0].height };
  }
  return probeCache[file];
};

// Collect one entry per image-filled node.
const jobs = new Map();   // key -> job
const nodeAsset = {};     // node id -> key

(function walk(n) {
  const fill = (n.fills || []).filter(f => f.visible !== false).find(f => f.type === 'IMAGE');
  if (fill && fill.imageRef) {
    const short = fill.imageRef.slice(0, 12);
    const file = originals[short];
    if (file) {
      const b = n.absoluteBoundingBox || {};
      // For rotated nodes the drawn box is node.size, not the axis-aligned bbox.
      const m = n.relativeTransform;
      const rotated = m && Math.abs(m[0][1]) > 0.001;
      const dw = Math.round(rotated ? n.size.x : b.width);
      const dh = Math.round(rotated ? n.size.y : b.height);

      const t = fill.imageTransform;
      const crop = t ? [t[0][0], t[1][1], t[0][2], t[1][2]].map(v => +v.toFixed(6)) : null;
      const key = `${short}_${dw}x${dh}_${crop ? crop.join('_') : 'nocrop'}`
        .replace(/[^\w.-]/g, '');

      if (!jobs.has(key)) jobs.set(key, { key, short, file, dw, dh, crop, mode: fill.scaleMode, nodes: [] });
      jobs.get(key).nodes.push(n.name);
      nodeAsset[n.id] = key;
    }
  }
  (n.children || []).forEach(walk);
})(root);

console.log(`${jobs.size} unique image assets for ${Object.keys(nodeAsset).length} nodes\n`);

let total = 0;
const assets = {};

for (const job of jobs.values()) {
  const nat = probe(job.file);
  const filters = [];
  let availW = nat.w, availH = nat.h;

  if (job.crop) {
    const [sx, sy, tx, ty] = job.crop;
    const cw = Math.max(1, Math.round(nat.w * sx));
    const ch = Math.max(1, Math.round(nat.h * sy));
    const cx = Math.min(nat.w - cw, Math.max(0, Math.round(nat.w * tx)));
    const cy = Math.min(nat.h - ch, Math.max(0, Math.round(nat.h * ty)));
    filters.push(`crop=${cw}:${ch}:${cx}:${cy}`);
    availW = cw; availH = ch;
  }

  // FILL -> object-fit:cover, so the asset must COVER the box (max, not min).
  // Cropped/STRETCH fills map the crop rect onto the box exactly.
  const wantW = job.dw * DPR, wantH = job.dh * DPR;
  const factor = job.crop
    ? Math.min(1, wantW / availW, wantH / availH)
    : Math.min(1, Math.max(wantW / availW, wantH / availH));
  const tw = Math.max(1, Math.round(availW * factor));
  const th = Math.max(1, Math.round(availH * factor));
  filters.push(`scale=${tw}:${th}:flags=lanczos`);

  const outFile = `${job.key}.webp`;
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', path.join(srcDir, job.file), '-vf', filters.join(','),
    '-c:v', 'libwebp', '-quality', String(QUALITY), '-compression_level', '6',
    path.join(outDir, outFile)]);

  const bytes = fs.statSync(path.join(outDir, outFile)).size;
  total += bytes;
  assets[job.key] = { file: outFile, bytes, w: tw, h: th, mode: job.mode, cropped: !!job.crop };
}

console.log(`Total optimized: ${(total / 1024 / 1024).toFixed(2)} MB  (~${(total * 1.37 / 1024 / 1024).toFixed(2)} MB base64)`);
const sorted = Object.entries(assets).sort((a, b) => b[1].bytes - a[1].bytes);
console.log(`\n5 heaviest:`);
sorted.slice(0, 5).forEach(([k, v]) => console.log(`  ${(v.bytes / 1024).toFixed(0).padStart(4)} KB  ${v.w}x${v.h}  ${v.cropped ? 'cropped' : v.mode}  ${k.slice(0, 40)}`));

fs.writeFileSync(path.join(__dirname, 'assets.json'), JSON.stringify({ assets, nodeAsset }, null, 2));
console.log(`\nwrote assets.json`);

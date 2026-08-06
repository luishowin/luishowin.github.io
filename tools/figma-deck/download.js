// Download every image fill referenced by the frame.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'assets');
fs.mkdirSync(dir, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));

const sniff = buf => {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.slice(0, 5).toString().includes('svg') || buf.slice(0, 5).toString() === '<?xml') return 'svg';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'gif';
  return 'bin';
};

(async () => {
  let total = 0;
  const results = [];
  const queue = [...manifest];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        const res = await fetch(item.url);
        if (!res.ok) { console.log(`  FAIL ${res.status}  ${item.ref.slice(0, 8)}`); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = sniff(buf);
        const file = `${item.ref.slice(0, 12)}.${ext}`;
        fs.writeFileSync(path.join(dir, file), buf);
        total += buf.length;
        results.push({ ...item, file, bytes: buf.length, ext });
      } catch (e) {
        console.log(`  ERROR ${item.ref.slice(0, 8)}: ${e.message}`);
      }
    }
  });
  await Promise.all(workers);

  results.sort((a, b) => b.bytes - a.bytes);
  console.log(`Downloaded ${results.length}/${manifest.length}`);
  console.log(`Total raw bytes: ${(total / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Est. base64 inflation: ${(total * 1.37 / 1024 / 1024).toFixed(1)} MB\n`);
  const byExt = {};
  results.forEach(r => { byExt[r.ext] = (byExt[r.ext] || 0) + 1; });
  console.log(`Formats: ${Object.entries(byExt).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`\n10 heaviest:`);
  results.slice(0, 10).forEach(r =>
    console.log(`  ${(r.bytes / 1024 / 1024).toFixed(2)} MB  ${r.ext.padEnd(4)} shown at ${r.maxW}x${r.maxH}  ${r.nodes[0]}`));

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(results, null, 2));
})();

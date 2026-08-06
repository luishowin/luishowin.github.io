// Download latin-subset WOFF2 files for the fonts the frame uses, base64 for inlining.
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const WANT = [
  { family: 'Inter', weights: [400, 700] },
  { family: 'Inria Serif', weights: [400] },
  { family: 'Bahianita', weights: [400] },
];

(async () => {
  const faces = [];
  for (const { family, weights } of WANT) {
    const q = `${family.replace(/ /g, '+')}:wght@${weights.join(';')}`;
    const url = `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
    const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();

    // Split into @font-face blocks, keep only the `latin` subset of each weight.
    const blocks = css.split('@font-face').slice(1);
    for (const b of blocks) {
      const isLatin = /\/\*\s*latin\s*\*\//.test(css.slice(0, css.indexOf(b)).split('/*').slice(-1)[0] || '');
      const wMatch = b.match(/font-weight:\s*(\d+)/);
      const uMatch = b.match(/src:\s*url\(([^)]+)\)/);
      if (!wMatch || !uMatch) continue;
      const weight = parseInt(wMatch[1], 10);
      if (!weights.includes(weight)) continue;

      // The comment immediately preceding this block names the subset.
      const idx = css.indexOf(b);
      const preceding = css.slice(0, idx);
      const lastComment = (preceding.match(/\/\*\s*([\w-]+)\s*\*\/(?![\s\S]*\/\*)/) || [])[1]
        || (preceding.split('/*').pop() || '').split('*/')[0].trim();
      if (lastComment !== 'latin') continue;

      const buf = Buffer.from(await (await fetch(uMatch[1], { headers: { 'User-Agent': UA } })).arrayBuffer());
      faces.push({ family, weight, bytes: buf.length, b64: buf.toString('base64') });
      console.log(`  ${family} ${weight}  ${(buf.length / 1024).toFixed(1)} KB`);
    }
  }
  const total = faces.reduce((a, f) => a + f.bytes, 0);
  console.log(`\n${faces.length} faces, ${(total / 1024).toFixed(1)} KB raw / ~${(total * 1.37 / 1024).toFixed(0)} KB base64`);
  fs.writeFileSync(path.join(__dirname, 'fonts.json'), JSON.stringify(faces));
})();

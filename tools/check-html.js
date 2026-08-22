// Structural sanity checks over docs/*.html for the redesigned pages.
// - duplicate ids per page
// - <img> without alt / width+height
// - headings skipping levels (h1 -> h3)
// Run: node tools/check-html.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'docs');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const problems = [];

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const html = raw.replace(/<script\b[\s\S]*?<\/script>/gi, '<script></script>');

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length) problems.push(`${f}: duplicate ids -> ${[...new Set(dupes)].join(', ')}`);

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\balt=/.test(tag)) {
      const src = (tag.match(/src="([^"]*)"/) || [])[1] || '?';
      problems.push(`${f}: <img> missing alt -> ${src}`);
    }
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
      const src = (tag.match(/src="([^"]*)"/) || [])[1] || '?';
      problems.push(`${f}: <img> missing width/height -> ${src}`);
    }
  }

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map(m => +m[1]);
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      problems.push(`${f}: heading level jump h${headings[i - 1]} -> h${headings[i]} (occurrence #${i + 1})`);
      break;
    }
  }
}

console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'structure ok');
process.exitCode = problems.length ? 1 : 0;

// Check every docs/*.html page for local refs that don't resolve.
// - href/src pointing at files that don't exist in docs/
// - same-page and cross-page #anchors that have no matching id
// Run from repo root: node tools/check-links.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'docs');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const problems = [];
const idMap = {};

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  // Strip <script> bodies: template literals there legitimately contain
  // strings like "#${id}" that would false-positive as anchors.
  const html = raw.replace(/<script\b[\s\S]*?<\/script>/gi, '<script></script>');
  idMap[f] = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  for (const m of html.matchAll(/(?:href|src)="([^"#]+)(#[^"]*)?"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|data:)/.test(ref)) continue;
    const clean = ref.split('#')[0];
    if (!clean) continue;
    if (!fs.existsSync(path.join(dir, clean))) problems.push(`${f} -> missing file: ${ref}`);
  }
}

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const html = raw.replace(/<script\b[\s\S]*?<\/script>/gi, '<script></script>');
  for (const m of html.matchAll(/href="([^"]*?)#([^"]+)"/g)) {
    let page = m[1], anchor = m[2];
    if (/^https?:/.test(page)) continue;
    const pf = page ? path.basename(page) : f;
    if (idMap[pf] && !idMap[pf].has(anchor)) problems.push(`${f} -> missing anchor ${pf}#${anchor}`);
  }
}

console.log(files.join(', '));
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'all local refs + anchors resolve');
process.exitCode = problems.length ? 1 : 0;

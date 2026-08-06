// Inspect the fetched Figma node tree.
//   node inspect.js [--depth N] [--path "A/B/C"] [--text]
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'figma-node.json'), 'utf8'));
const root = raw.nodes[Object.keys(raw.nodes)[0]].document;

const args = process.argv.slice(2);
const getArg = (f, d) => { const i = args.indexOf(f); return i === -1 ? d : args[i + 1]; };
const maxDepth = parseInt(getArg('--depth', '2'), 10);
const startPath = getArg('--path', null);
const showText = args.includes('--text');

const rgba = (c, o) => {
  if (!c) return '';
  const n = v => Math.round(v * 255);
  const a = (o !== undefined ? o : 1) * (c.a !== undefined ? c.a : 1);
  return a < 0.999 ? `rgba(${n(c.r)},${n(c.g)},${n(c.b)},${+a.toFixed(2)})`
                   : `#${[c.r, c.g, c.b].map(v => n(v).toString(16).padStart(2, '0')).join('')}`;
};

function fillSummary(n) {
  if (!n.fills || !n.fills.length) return '';
  const parts = n.fills.filter(f => f.visible !== false).map(f => {
    if (f.type === 'SOLID') return rgba(f.color, f.opacity);
    if (f.type === 'IMAGE') return `IMAGE(${f.imageRef ? f.imageRef.slice(0, 8) : '?'})`;
    if (f.type && f.type.startsWith('GRADIENT')) return f.type.replace('GRADIENT_', 'grad:').toLowerCase();
    return f.type;
  });
  return parts.length ? ` fill=${parts.join(',')}` : '';
}

function layoutSummary(n) {
  const bits = [];
  if (n.layoutMode && n.layoutMode !== 'NONE') {
    bits.push(n.layoutMode === 'HORIZONTAL' ? 'row' : 'col');
    if (n.itemSpacing) bits.push(`gap:${n.itemSpacing}`);
    const p = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft];
    if (p.some(v => v)) bits.push(`pad:${p.map(v => v || 0).join('/')}`);
    if (n.primaryAxisAlignItems) bits.push(`main:${n.primaryAxisAlignItems}`);
    if (n.counterAxisAlignItems) bits.push(`cross:${n.counterAxisAlignItems}`);
  }
  if (n.layoutSizingHorizontal) bits.push(`w:${n.layoutSizingHorizontal}`);
  if (n.layoutSizingVertical) bits.push(`h:${n.layoutSizingVertical}`);
  return bits.length ? ` [${bits.join(' ')}]` : '';
}

function findByPath(node, segs) {
  if (!segs.length) return node;
  const [head, ...rest] = segs;
  const kid = (node.children || []).find(c => c.name === head);
  if (!kid) throw new Error(`No child "${head}" under "${node.name}". Children: ${(node.children || []).map(c => c.name).join(' | ')}`);
  return findByPath(kid, rest);
}

let counts = {};
function tally(n) {
  counts[n.type] = (counts[n.type] || 0) + 1;
  (n.children || []).forEach(tally);
}

function walk(n, depth, prefix) {
  const b = n.absoluteBoundingBox;
  const size = b ? `${Math.round(b.width)}x${Math.round(b.height)}` : '-';
  let line = `${prefix}${n.name}  <${n.type}> ${size}${layoutSummary(n)}${fillSummary(n)}`;
  if (n.type === 'TEXT') {
    const s = n.style || {};
    line += `  ${s.fontFamily || '?'} ${s.fontWeight || ''} ${s.fontSize || '?'}px/${s.lineHeightPx ? Math.round(s.lineHeightPx) : '?'}`;
    if (showText) line += `\n${prefix}    "${(n.characters || '').replace(/\n/g, '\\n').slice(0, 120)}"`;
  }
  console.log(line);
  if (depth < maxDepth) (n.children || []).forEach(c => walk(c, depth + 1, prefix + '  '));
  else if (n.children && n.children.length) console.log(`${prefix}  ... ${n.children.length} more child(ren)`);
}

const start = startPath ? findByPath(root, startPath.split('/').filter(Boolean)) : root;
tally(root);

console.log(`ROOT: ${root.name} (${Math.round(root.absoluteBoundingBox.width)}x${Math.round(root.absoluteBoundingBox.height)})`);
console.log(`NODE COUNTS: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`TOTAL: ${Object.values(counts).reduce((a, b) => a + b, 0)} nodes\n`);
walk(start, 0, '');

// Emit expected on-page geometry for every image + text node, for DOM comparison.
const fs = require('fs');
const path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'figma-node.json'), 'utf8'));
const root = raw.nodes[Object.keys(raw.nodes)[0]].document;
const R = root.absoluteBoundingBox;

const imgs = [], texts = [];
(function w(n) {
  const b = n.absoluteBoundingBox;
  if (b) {
    const rec = [+(b.x - R.x).toFixed(2), +(b.y - R.y).toFixed(2), +b.width.toFixed(2), +b.height.toFixed(2)];
    const hasImg = (n.fills || []).some(f => f.visible !== false && f.type === 'IMAGE');
    if (hasImg) imgs.push([n.name, ...rec]);
    else if (n.type === 'TEXT') texts.push([(n.characters || '').slice(0, 24), ...rec]);
  }
  (n.children || []).forEach(w);
})(root);

fs.writeFileSync(path.join(__dirname, 'expected.json'), JSON.stringify({ imgs, texts }));
console.log(`imgs=${imgs.length} texts=${texts.length}`);
console.log(`bytes=${fs.statSync(path.join(__dirname, 'expected.json')).size}`);

// Generate docs/portfolio.html from the fetched Figma frame.
//
// This script rewrites the output file WHOLESALE. Any hand-edit to
// docs/portfolio.html is lost on the next run — put intentional changes in the
// template below, never in the output.
//
// Images and fonts are referenced, not inlined: the deck is ~15 screens tall, so
// inlining would force every visitor to download 2.3 MB before anything paints
// and would make the emitted loading="lazy" inert.
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const REPO = path.resolve(SP, '..', '..');
const OUT = process.argv[2] || path.join(REPO, 'docs', 'portfolio.html');

const raw = JSON.parse(fs.readFileSync(path.join(SP, 'figma-node.json'), 'utf8'));
const root = raw.nodes[Object.keys(raw.nodes)[0]].document;
const { assets, nodeAsset } = JSON.parse(fs.readFileSync(path.join(SP, 'assets.json'), 'utf8'));
const fonts = JSON.parse(fs.readFileSync(path.join(SP, 'fonts.json'), 'utf8'));

const W = Math.round(root.absoluteBoundingBox.width);
const H = Math.round(root.absoluteBoundingBox.height);

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n2 = v => (Math.round(v * 100) / 100);

function color(c, opacity) {
  if (!c) return 'transparent';
  const to255 = v => Math.round(v * 255);
  const a = (opacity !== undefined ? opacity : 1) * (c.a !== undefined ? c.a : 1);
  if (a <= 0.001) return 'transparent';
  if (a >= 0.999) return '#' + [c.r, c.g, c.b].map(v => to255(v).toString(16).padStart(2, '0')).join('');
  return `rgba(${to255(c.r)},${to255(c.g)},${to255(c.b)},${n2(a)})`;
}

function solidFill(node) {
  const f = (node.fills || []).find(f => f.visible !== false && f.type === 'SOLID');
  return f ? color(f.color, f.opacity) : null;
}

function gradientFill(node) {
  const f = (node.fills || []).find(f => f.visible !== false && (f.type || '').startsWith('GRADIENT'));
  if (!f) return null;
  const stops = (f.gradientStops || []).map(s => `${color(s.color)} ${n2(s.position * 100)}%`).join(', ');
  if (f.type === 'GRADIENT_RADIAL') return `radial-gradient(${stops})`;
  // Derive the angle from the gradient handles.
  const h = f.gradientHandlePositions || [];
  let deg = 180;
  if (h.length >= 2) deg = n2((Math.atan2(h[1].x - h[0].x, -(h[1].y - h[0].y)) * 180) / Math.PI);
  return `linear-gradient(${deg}deg, ${stops})`;
}

const rotationOf = node => {
  const m = node.relativeTransform;
  if (!m) return 0;
  const deg = (Math.atan2(m[1][0], m[0][0]) * 180) / Math.PI;
  return Math.abs(deg) < 0.01 ? 0 : n2(deg);
};

// Box of `node` expressed relative to `parentBox` (absolute coords).
function boxRelativeTo(node, parentBox) {
  const b = node.absoluteBoundingBox;
  if (!b) return null;
  const rot = rotationOf(node);
  if (rot && node.size) {
    // Rotation about the centre keeps the bounding-box centre fixed.
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    return {
      x: cx - node.size.x / 2 - parentBox.x,
      y: cy - node.size.y / 2 - parentBox.y,
      w: node.size.x, h: node.size.y, rot,
    };
  }
  return { x: b.x - parentBox.x, y: b.y - parentBox.y, w: b.width, h: b.height, rot: 0 };
}

const posStyle = box => {
  let s = `left:${n2(box.x)}px;top:${n2(box.y)}px;width:${n2(box.w)}px;height:${n2(box.h)}px`;
  if (box.rot) s += `;transform:rotate(${box.rot}deg)`;
  return s;
};

// ---------- asset URLs ----------
// Served from docs/images/portfolio/ — copy assets-opt/*.webp there after prep.js.
const assetUrl = key => `./images/portfolio/${assets[key].file}`;

const FONT_STACK = {
  'Inter': `'Inter',system-ui,-apple-system,'Segoe UI',sans-serif`,
  'Inria Serif': `'Inria Serif',Georgia,'Times New Roman',serif`,
  'Bahianita': `'Bahianita',cursive`,
  'Arial': `Arial,Helvetica,sans-serif`,
};

// ---------- renderers ----------
// A run of characters can override the node's base style (Figma's styleOverrideTable).
function overrideCss(ov, baseRatio) {
  const css = [];
  if (ov.fontSize) {
    css.push(`font-size:${n2(ov.fontSize)}px`);
    // Figma's line height here is "auto" (INTRINSIC_%), which scales with the run's size.
    css.push(`line-height:${n2(ov.fontSize * baseRatio)}px`);
  }
  if (ov.fontFamily) css.push(`font-family:${FONT_STACK[ov.fontFamily] || `'${ov.fontFamily}',sans-serif`}`);
  if (ov.fontWeight) css.push(`font-weight:${ov.fontWeight}`);
  if (ov.italic) css.push('font-style:italic');
  if (ov.letterSpacing) css.push(`letter-spacing:${n2(ov.letterSpacing)}px`);
  if (ov.textCase === 'UPPER') css.push('text-transform:uppercase');
  if (ov.textDecoration === 'UNDERLINE') css.push('text-decoration:underline');
  if (ov.lineHeightPx) css.push(`line-height:${n2(ov.lineHeightPx)}px`);   // explicit wins
  if (ov.fills) {
    const f = ov.fills.find(x => x.visible !== false && x.type === 'SOLID');
    if (f) css.push(`color:${color(f.color, f.opacity)}`);
  }
  return css.join(';');
}

// Emit characters [from,to) split into spans wherever the override id changes.
function styledRange(node, from, to, baseRatio) {
  const s = node.characters || '';
  const cso = node.characterStyleOverrides || [];
  const tbl = node.styleOverrideTable || {};
  if (from >= to) return '';
  let out = '', start = from;
  for (let i = from + 1; i <= to; i++) {
    const prev = cso[i - 1] || 0;
    const here = i < to ? (cso[i] || 0) : null;
    if (here !== prev) {
      const text = s.slice(start, i);
      const css = tbl[prev] ? overrideCss(tbl[prev], baseRatio) : '';
      out += css ? `<span style="${css}">${esc(text)}</span>` : esc(text);
      start = i;
    }
  }
  return out;
}

// Tallest effective line height among the runs on one line. Each line is emitted in its
// own block so the container's line-height cannot impose a taller strut on a small run —
// that is what Figma does, and leaving it to the strut drops small runs by ~29px.
// The line box is also shaped by the strut, which comes from the block's own font-size.
// Emit the tallest run's font-size alongside its line-height or the strut (still at the
// node's base size) inflates the line and pushes small runs down.
function lineMetrics(node, from, to, baseRatio) {
  const st = node.style || {};
  const cso = node.characterStyleOverrides || [];
  const tbl = node.styleOverrideTable || {};
  const baseSize = st.fontSize || 16;
  const baseLh = st.lineHeightPx || baseSize * baseRatio;

  // An empty line still has a style: the one carried by its own newline character.
  // Falling back to the node's base size here makes blank lines the wrong height.
  if (from >= to) {
    const ov = tbl[cso[Math.min(from, (node.characters || '').length - 1)] || 0];
    if (!ov) return { size: baseSize, lh: baseLh };
    return {
      size: ov.fontSize || baseSize,
      lh: ov.lineHeightPx || (ov.fontSize ? ov.fontSize * baseRatio : baseLh),
    };
  }

  let best = { size: baseSize, lh: -1 };
  for (let i = from; i < to; i++) {
    const ov = tbl[cso[i] || 0];
    const size = ov && ov.fontSize ? ov.fontSize : baseSize;
    const lh = ov ? (ov.lineHeightPx || (ov.fontSize ? ov.fontSize * baseRatio : baseLh)) : baseLh;
    if (lh > best.lh) best = { size, lh };
  }
  return best;
}

// Figma keeps list numbering/bullets in lineTypes, not in `characters` — rebuild them.
function textContent(node) {
  const st = node.style || {};
  const baseRatio = st.lineHeightPx && st.fontSize ? st.lineHeightPx / st.fontSize : 1.21;
  const s = node.characters || '';
  const lt = node.lineTypes || [];

  // Char ranges per hard line, so list markers and style runs can coexist.
  const ranges = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') { ranges.push([start, i]); start = i + 1; }
  ranges.push([start, s.length]);

  const ind = node.lineIndentations || [];
  const out = [];
  let i = 0;
  while (i < ranges.length) {
    const type = lt[i] || 'NONE';
    if (type === 'NONE') {
      const [a, b] = ranges[i];
      const inner = styledRange(node, a, b, baseRatio);
      const m = lineMetrics(node, a, b, baseRatio);
      out.push(`<div style="font-size:${n2(m.size)}px;line-height:${n2(m.lh)}px">${inner || '<br>'}</div>`);
      i++;
    } else {
      const ordered = type === 'ORDERED';
      let num = 1;
      const items = [];
      while (i < ranges.length && (lt[i] || 'NONE') === type) {
        const level = Math.max(1, ind[i] || 1);
        const [a, b] = ranges[i];
        const m = lineMetrics(node, a, b, baseRatio);
        items.push(`<div class="li" style="padding-left:${(level - 1) * 24}px;`
          + `font-size:${n2(m.size)}px;line-height:${n2(m.lh)}px">`
          + `<span class="mk">${ordered ? num++ + '.' : '&bull;'}</span>`
          + `<span>${styledRange(node, a, b, baseRatio)}</span></div>`);
        i++;
      }
      out.push(items.join(''));
    }
  }
  return out.join('');
}

function renderText(node, box) {
  const s = node.style || {};
  const css = [posStyle(box), 'position:absolute'];
  css.push(`font-family:${FONT_STACK[s.fontFamily] || `'${s.fontFamily}',sans-serif`}`);
  css.push(`font-size:${n2(s.fontSize)}px`);
  if (s.fontWeight) css.push(`font-weight:${s.fontWeight}`);
  if (s.italic) css.push('font-style:italic');
  if (s.lineHeightPx) css.push(`line-height:${n2(s.lineHeightPx)}px`);
  if (s.letterSpacing) css.push(`letter-spacing:${n2(s.letterSpacing)}px`);
  if (s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT')
    css.push(`text-align:${s.textAlignHorizontal.toLowerCase()}`);
  if (s.textCase === 'UPPER') css.push('text-transform:uppercase');
  if (s.textDecoration === 'UNDERLINE') css.push('text-decoration:underline');

  css.push(`color:${solidFill(node) || 'transparent'}`);

  // Figma OUTSIDE strokes on text -> painted behind the fill.
  const stroke = (node.strokes || []).find(x => x.visible !== false && x.type === 'SOLID');
  if (stroke && node.strokeWeight) {
    css.push(`-webkit-text-stroke:${n2(node.strokeWeight)}px ${color(stroke.color, stroke.opacity)}`);
    css.push('paint-order:stroke fill');
  }
  return `<div class="t" style="${css.join(';')}">${textContent(node)}</div>`;
}

function renderVector(node, box) {
  const geo = node.fillGeometry || [];
  const w = node.size ? node.size.x : box.w;
  const h = node.size ? node.size.y : box.h;
  if (!geo.length || !w || !h) return '';
  const fill = solidFill(node) || '#000';
  const paths = geo.map(g =>
    `<path d="${g.path}" fill="${fill}" fill-rule="${g.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero'}"/>`
  ).join('');
  return `<svg style="position:absolute;${posStyle(box)}" viewBox="0 0 ${n2(w)} ${n2(h)}" `
       + `preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

function renderImage(node, box) {
  const key = nodeAsset[node.id];
  if (!key) return '';
  const a = assets[key];
  // Cropped fills were baked to the box aspect already, so stretch; FILL fills cover.
  const fit = a.cropped ? 'fill' : (a.mode === 'FIT' ? 'contain' : 'cover');
  // alt="" is deliberate: these are a pixel reproduction of a design artefact and
  // the node names are raw Figma layer labels ("image 22"). The deck's own text is
  // real DOM text, and the page header carries the accessible summary.
  return `<img class="i" alt="" role="presentation" loading="lazy" `
       + `width="${Math.round(box.w)}" height="${Math.round(box.h)}" `
       + `style="position:absolute;${posStyle(box)};object-fit:${fit}" src="${assetUrl(key)}">`;
}

function renderBoxNode(node, box, inner) {
  const css = ['position:absolute', posStyle(box)];
  const bg = solidFill(node) || gradientFill(node);
  if (bg) css.push(bg.includes('gradient') ? `background:${bg}` : `background-color:${bg}`);
  if (node.clipsContent) css.push('overflow:hidden');
  if (node.opacity !== undefined && node.opacity < 1) css.push(`opacity:${n2(node.opacity)}`);
  const r = node.cornerRadius;
  if (r) css.push(`border-radius:${n2(r)}px`);
  else if (node.rectangleCornerRadii) css.push(`border-radius:${node.rectangleCornerRadii.map(v => n2(v) + 'px').join(' ')}`);
  const stroke = (node.strokes || []).find(x => x.visible !== false && x.type === 'SOLID');
  if (stroke && node.strokeWeight) css.push(`box-shadow:inset 0 0 0 ${n2(node.strokeWeight)}px ${color(stroke.color, stroke.opacity)}`);
  return `<div style="${css.join(';')}">${inner}</div>`;
}

let stats = { text: 0, image: 0, vector: 0, box: 0, skipped: 0 };

function render(node, parentBox) {
  if (node.visible === false) { stats.skipped++; return ''; }
  const box = boxRelativeTo(node, parentBox);
  if (!box) return '';

  if (node.type === 'TEXT') { stats.text++; return renderText(node, box); }
  if (nodeAsset[node.id]) { stats.image++; return renderImage(node, box); }
  if ((node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'STAR'
       || node.type === 'ELLIPSE' || node.type === 'REGULAR_POLYGON' || node.type === 'LINE')
      && (node.fillGeometry || []).length) {
    stats.vector++; return renderVector(node, box);
  }

  const absBox = node.absoluteBoundingBox;
  const kids = (node.children || []).map(c => render(c, absBox)).join('');
  stats.box++;
  return renderBoxNode(node, box, kids);
}

// Children are z-ordered back-to-front, matching DOM order for positioned elements.
const body = (root.children || []).map(c => render(c, root.absoluteBoundingBox)).join('\n');

// ---------- shared chrome, lifted straight out of index.html ----------
// Extracting rather than duplicating means the generated page can never drift
// from the home page. Edit the chrome in index.html; it lands here on rebuild.
const indexHtml = fs.readFileSync(path.join(REPO, 'docs', 'index.html'), 'utf8');

function between(source, startRe, endRe, label) {
  const a = source.search(startRe);
  const b = source.search(endRe);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(`Could not find the ${label} sentinels in docs/index.html. `
      + `Did someone remove the "══ SHARED …" markers?`);
  }
  // Start after the marker's line, and stop at the START of the end marker's line —
  // searching for the marker text alone would land inside its comment, taking the
  // opening "/*" without the closing "*/".
  const from = source.indexOf('\n', a) + 1;
  const to = source.lastIndexOf('\n', b);
  const slice = source.slice(from, to).replace(/\s+$/, '');

  // A sentinel spread over several lines would leave the tail of its own comment
  // (and a stray "*/") at the head of the slice. In CSS that swallows the next
  // rule whole — :root disappears and every var() silently resolves to nothing.
  // Cheap guard: comment delimiters must balance.
  const open = (slice.match(/\/\*/g) || []).length;
  const close = (slice.match(/\*\//g) || []).length;
  if (open !== close) {
    throw new Error(`Extracted ${label} has unbalanced comments (${open} "/*" vs `
      + `${close} "*/"). Put each ══ sentinel on its own line as a complete comment.`);
  }
  return slice;
}

const sharedCss = between(indexHtml, /══ SHARED CHROME v1 ══/, /══ END SHARED CHROME ══/, 'chrome CSS');
const sharedFooter = between(indexHtml, /══ SHARED FOOTER/, /══ END SHARED FOOTER ══/, 'footer');

// Same nav, but this is a separate page: in-page anchors must point back at the
// home page, and GRAPHICS becomes the current item rather than a link to self.
const sharedNav = between(indexHtml, /══ SHARED NAV/, /══ END SHARED NAV ══/, 'nav')
  .replace(/href="#(?!")/g, 'href="./index.html#')
  .replace(/href="\/"/, 'href="./index.html"')
  .replace(/<a href="\.\/portfolio\.html">GRAPHICS<\/a>/,
           '<a href="./portfolio.html" class="is-active" aria-current="page">GRAPHICS</a>');

// Inter, Old Standard TT and IBM Plex Mono all arrive via the site's Google Fonts
// request (700 added for the deck). Only the two display faces Google isn't already
// serving to this page are self-hosted — one source per family, no double download.
const selfHosted = fonts.filter(f => f.family !== 'Inter');
const fontFaces = selfHosted.map(f =>
  `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;`
  + `src:url("./fonts/${f.family.toLowerCase().replace(/[^a-z]+/g, '-')}-${f.weight}.woff2") format('woff2')}`
).join('\n');

const rootBg = solidFill(root) || '#ffffff';

const PROJECTS = [
  ['Nanyuki Holiday Home', 'Branding, web design and photography'],
  ['Jimmy Rosemond Book Launch', 'Web design'],
  ['Carbon Slash', 'Print design'],
  ['Raha Luxury Concierge', 'Logo design, branding and web design'],
  ['Neopolaris AI', 'Logo design, branding, web and batch post design'],
  ['Queens of the Dust', 'Logo design and branding'],
  ['Munch Hub', 'Flyers and social design'],
];

const projectList = PROJECTS.map(([name, role]) =>
  `                <li><span class="deck-project__name">${name}</span>`
  + `<span class="deck-project__role">${role}</span></li>`
).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Graphic Design Portfolio — Luis Howin Maina</title>
<!--
  GENERATED FILE — do not edit by hand.
  Produced by tools/figma-deck/build.js from Figma frame "${root.name}" (${W}x${H}).
  Every edit here is overwritten on the next build; change the template instead.

  The deck is a faithful reproduction of the source frame's absolute positioning.
  That frame uses no auto-layout, so the canvas is fixed-width and scales to fit
  narrow viewports rather than reflowing — reflowing would destroy the alignment.
-->
<meta name="description" content="Graphic design portfolio of Luis Howin Maina — logo design, branding, print and web for Nanyuki Holiday Home, Carbon Slash, Raha Luxury Concierge, Neopolaris AI, Queens of the Dust and Munch Hub.">
<meta name="author" content="Luis Howin Maina">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://luishowin.github.io/portfolio.html">
<meta name="theme-color" content="#0B0E11">
<meta name="color-scheme" content="dark">

<meta property="og:title" content="Graphic Design Portfolio — Luis Howin Maina" />
<meta property="og:description" content="Seven client and personal identities — logo design, branding, packaging, print and web." />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://luishowin.github.io/portfolio.html" />
<meta property="og:image" content="https://luishowin.github.io/images/og-cover.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="en_GB" />
<meta property="og:site_name" content="Luis Howin Maina" />
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Graphic Design Portfolio — Luis Howin Maina">
<meta name="twitter:image" content="https://luishowin.github.io/images/og-cover.jpg">

<link rel="icon" href="./images/icon.webp" type="image/webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Old+Standard+TT:ital,wght@0,400;1,400&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="preload" as="font" type="font/woff2" href="./fonts/inria-serif-400.woff2" crossorigin>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "name": "Graphic Design Portfolio",
  "url": "https://luishowin.github.io/portfolio.html",
  "author": { "@type": "Person", "name": "Luis Howin Maina", "url": "https://luishowin.github.io/" },
  "about": ${JSON.stringify(PROJECTS.map(p => p[0]))},
  "inLanguage": "en"
}
</script>

<style>
${fontFaces}

${sharedCss}

/* ── DECK PAGE ── */
.page-hero {
    padding: clamp(72px, 9vw, 112px) 0 var(--space-xl);
}
/* The home page numbers its sections 01–06. This page has one, so a "01"
   would imply a sequence that isn't there. Keep the label, drop the counter. */
.page-hero .section-label::before { content: none; }
.page-hero h1 {
    font-family: var(--font-title);
    font-size: var(--step-4);
    font-weight: 400;
    color: var(--color-headers);
    line-height: 1.08;
    margin-bottom: var(--space-m);
    max-width: var(--measure-head);
}
.page-hero__sub {
    font-size: var(--step-0);
    color: var(--color-text-muted);
    line-height: 1.75;
    max-width: var(--measure-tight);
    margin-bottom: var(--space-l);
}
.deck-projects {
    list-style: none;
    border-top: 1px solid var(--color-border);
    max-width: var(--measure);
}
.deck-projects li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-m);
    flex-wrap: wrap;
    padding: var(--space-xs) 0;
    border-bottom: 1px solid var(--color-border);
}
.deck-project__name {
    font-family: var(--font-mono);
    font-size: var(--step--1);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-headers);
}
.deck-project__role {
    font-size: var(--step--1);
    color: var(--color-text-muted);
}
.deck-back {
    display: inline-block;
    margin-top: var(--space-l);
    font-family: var(--font-mono);
    font-size: var(--step--2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-text);
    border-bottom: 1px solid var(--accent-text);
}
/* Shown only where the canvas is scaled small enough to be hard to read. */
.deck-note {
    display: none;
    font-family: var(--font-mono);
    font-size: var(--step--2);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-xs) var(--space-s);
    margin-bottom: var(--space-m);
}
@media (max-width: 760px) { .deck-note { display: block; } }

/* ── DECK CANVAS ──
   The canvas keeps its own light surface, deliberately banded between the dark
   nav above and dark footer below. These rules are scoped to #viewport / #stage:
   left on html/body they would drag the site chrome light too. */
#viewport {
    width: 100%;
    overflow: hidden;
    background: #e8e8e8;
}
#stage {
    position: relative;
    width: ${W}px;
    height: ${H}px;
    background: ${rootBg};
    overflow: hidden;
    /* top left, not top center: the canvas is wider than a phone viewport, so
       its layout box starts at x=0 and its centre sits at ${Math.round(W / 2)}px. Scaling
       about that centre would push the shrunken deck off to the right, off
       screen entirely. Origin at the left corner keeps it at x=0, and the
       script below translates it to centre it. */
    transform-origin: top left;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}
#stage .t { white-space: pre-wrap; word-break: break-word; }
#stage .li { display: flex; }
#stage .mk { flex: none; width: 26px; }
#stage .i { display: block; }
#stage svg { display: block; overflow: visible; }

@media print {
    #viewport { background: #fff; }
    #stage { transform: none !important; }
    .nav, footer, .deck-note, .deck-back { display: none; }
}
</style>
</head>
<body>

<a href="#main" class="skip-link">Skip to content</a>

${sharedNav}

<main id="main">

<section class="page-hero">
    <div class="container">
        <span class="section-label">Graphic design</span>
        <h1>Branding &amp; print, ${PROJECTS.length} projects.</h1>
        <p class="page-hero__sub">Logo design, branding, packaging, print and web &mdash; client and personal work from 2024 to 2026. Client material is shown with written permission; anything confidential has been removed or concealed.</p>
        <ul class="deck-projects">
${projectList}
        </ul>
        <a href="./index.html#work" class="deck-back">&larr; Back to work</a>
    </div>
</section>

<div class="container">
    <p class="deck-note">This deck is laid out for a wider screen. Pinch to zoom, or open it on a desktop.</p>
</div>

<div id="viewport"><div id="stage">
${body}
</div></div>

</main>

${sharedFooter}

<script>
// The source frame is a fixed ${W}px canvas. Scale it down (never up) so it fits
// narrow screens, shrink the wrapper to match so no dead space is left below,
// and translate it back to centre — #stage has transform-origin: top left, so
// without the translate it would sit flush against the left edge on wide screens.
(function () {
  var stage = document.getElementById('stage');
  var viewport = document.getElementById('viewport');
  var W = ${W}, H = ${H};
  function fit() {
    var vw = viewport.clientWidth;
    var s = Math.min(1, vw / W);
    var offset = Math.max(0, (vw - W * s) / 2);
    stage.style.transform = 'translateX(' + offset + 'px) scale(' + s + ')';
    viewport.style.height = (H * s) + 'px';
  }
  fit();
  // ResizeObserver rather than the window resize event alone: it fires whenever
  // the wrapper's own box changes — scrollbar appearing, orientation change,
  // mobile browser chrome collapsing — cases where resize can be missed.
  if (window.ResizeObserver) new ResizeObserver(fit).observe(viewport);
  else addEventListener('resize', fit);
})();

// Nav shadow on scroll — same behaviour as the home page.
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  addEventListener('scroll', function () {
    nav.classList.toggle('nav--scrolled', window.scrollY > 20);
  }, { passive: true });
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
const kb = fs.statSync(OUT).size / 1024;
console.log(`Rendered: ${JSON.stringify(stats)}`);
console.log(`Wrote ${OUT}`);
console.log(`Size: ${(kb / 1024).toFixed(2)} MB`);

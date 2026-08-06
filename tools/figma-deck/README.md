# figma-deck

Generates `docs/portfolio.html`, the graphic-design portfolio deck, from a Figma frame.

Nothing in `tools/` is published: GitHub Pages serves only `/docs`.

## Why this exists

`docs/portfolio.html` is **generated**. `build.js` rewrites it wholesale on every run, so
**any hand-edit to `docs/portfolio.html` is lost the next time you run the build.** Every
intentional change belongs in the `build.js` template, never in the output.

The page is a pixel reproduction of Figma frame `25:123` ("Frame 21", 1168 × 17987) from
file `EM3VdvSjQE6IMJIKQXl7bJ`. It was verified against Figma's own render: all 81 image and
text nodes land within 0.75px of their Figma coordinates.

## Files

| file | role |
|---|---|
| `fetch-figma-node.ps1` | Pulls the frame from the Figma REST API. Needs `$env:FIGMA_TOKEN`. |
| `download.js` | Downloads the original image fills listed in `image-manifest.json`. |
| `prep.js` | Applies each layer's Figma crop, resamples to 2× display size, encodes WebP (needs ffmpeg). |
| `fonts.js` | Fetches latin-subset WOFF2 for Inter / Inria Serif / Bahianita into `fonts.json`. |
| `build.js` | Emits `docs/portfolio.html`. |
| `inspect.js` | Prints the frame's node tree, useful when something looks wrong. |
| `expected.js` | Emits expected on-page geometry, for verifying the render against Figma. |
| `figma-node.json` | The fetched frame (866 KB). Committed so a rebuild needs no Figma token. |
| `assets.json` | Maps each node to its optimized asset. Written by `prep.js`. |
| `fonts.json` | Base64 WOFF2 payloads. Written by `fonts.js`. |

Deliberately **not** committed: the raw Figma image originals (~45 MB; `download.js`
re-fetches them) and `figma-render.png` (9.6 MB reference render).

## Rebuild

Only needed if the Figma frame changes.

```powershell
# 1. Re-fetch the frame (only if the design changed)
$env:FIGMA_TOKEN = '<a Figma personal access token with file_content:read>'
.\fetch-figma-node.ps1 -Url 'https://www.figma.com/design/EM3VdvSjQE6IMJIKQXl7bJ/...?node-id=25-123'

# 2. Re-download originals and re-optimize (needs ffmpeg on PATH)
node download.js
node prep.js

# 3. Regenerate the page
node build.js
```

`prep.js` writes optimized WebP to `assets-opt/`; copy those to `docs/images/portfolio/`.
`build.js` writes `docs/portfolio.html` and references `./images/portfolio/*.webp` and
`./fonts/*.woff2`. It does **not** inline them.

## Notes

- The deck canvas is a fixed 1168 × 17987 px. It scales to fit narrow viewports rather than
  reflowing. Do not try to make it responsive: reflowing destroys the pixel accuracy.
- Three text behaviours were non-obvious and are handled in `build.js`: list markers live in
  `lineTypes` rather than the text string; project headings use per-character
  `styleOverrideTable` runs; and each line needs its own `font-size` *and* `line-height` or
  the CSS strut drops small runs by ~40px. See the comments on `textContent` and `lineMetrics`.

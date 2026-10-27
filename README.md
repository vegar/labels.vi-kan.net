# Gridfinity Labels

A browser-based, visual label maker for Gridfinity bins. Type your text, see the
label in 3D, and download a print-ready file. Everything runs in the browser;
there is no server.

Inspired by [label.alch.shop](https://label.alch.shop), with label geometry from
[gflabel](https://github.com/ndevenish/gflabel).

## What it does (v1)

- **Cullenect labels** ([Cullen J Webb's swappable label system](https://makerworld.com/en/models/446624)),
  1U to 3U wide (36, 78 or 120 × 11 mm), with optional snap-fit channels on 1U labels.
- One or more lines of text, auto-shrunk to fit, left/center/right aligned, Open Sans regular or bold.
- **Flush** (text inlaid level with the surface, for multi-colour printing) or **raised** text.
- Live 3D preview with label and text colours.
- **3MF export** with the label and the text as two parts of one object, so you can
  assign a filament to each in Bambu Studio, OrcaSlicer or PrusaSlicer. STL export as a zip of
  one file per part.

## Printing tips

- Print face up. For flush text, a 0.2 mm text depth equals one layer at 0.2 mm layer height.
- With a 0.4 mm nozzle, keep letters at least about 4.4 mm tall. The app warns when text is
  shrunk below that.

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # geometry and export tests
npm run build   # static site in dist/
```

Stack: TypeScript, Vite, [manifold-3d](https://github.com/elalish/manifold) (WASM) for solid
geometry, [opentype.js](https://opentype.js.org) for fonts, [three.js](https://threejs.org) for
the preview and [fflate](https://github.com/101arrowz/fflate) for zipping 3MF files.

### Deploying

`.github/workflows/ci.yml` tests and builds every push and pull request, and deploys `main`
to GitHub Pages. To turn deployment on, set **Settings → Pages → Source** to **GitHub Actions**.
For the `labels.vi-kan.net` domain, add it under **Settings → Pages → Custom domain**.

## Roadmap

- Fastener symbols (screw heads and drives, bolts, nuts, washers)
- Several labels at once on a print plate, exported as one slicer project
- More label holders from gflabel (pred, modern, predbox, tailorbox)

See `THIRD_PARTY_NOTICES.md` for licences of included code and fonts.

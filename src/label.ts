import type { Font } from "opentype.js";
import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import { cullenectBody, HEIGHT, widthForUnits } from "./cullenect";
import { isVariableWidth, renderSymbol, type LabelSymbol } from "./symbols";
import { layoutText, type Align } from "./text";

export type LabelStyle = "embedded" | "raised";
export type SymbolPosition = "left" | "right";

export interface LabelOptions {
  units: number;
  ribs: boolean;
  text: string;
  align: Align;
  maxCapHeight: number;
  margin: number;
  style: LabelStyle;
  /** Depth of embedded text, or height of raised text, in mm. */
  textDepth: number;
  /** Fastener symbols, drawn in a row beside the text. */
  symbols: LabelSymbol[];
  symbolPosition: SymbolPosition;
  /** Row height for the symbols, in mm. Symbols shrink below this to fit. */
  symbolSize: number;
}

export const DEFAULT_OPTIONS: LabelOptions = {
  units: 1,
  ribs: true,
  text: "M3 × 12",
  align: "center",
  maxCapHeight: 6,
  margin: 0.8,
  style: "embedded",
  textDepth: 0.2,
  symbols: [],
  symbolPosition: "left",
  symbolSize: 7,
};

/**
 * Deepest flush text that still leaves material over the snap-fit channels,
 * whose ceiling is 0.4 mm below the face.
 */
export function maxEmbeddedDepth(opts: Pick<LabelOptions, "units" | "ribs">): number {
  return opts.ribs && opts.units === 1 ? 0.3 : 0.8;
}

export interface LabelParts {
  base: Manifold;
  /** Undefined when the label has no text. */
  text?: Manifold;
  /** Undefined when the label has no symbols. */
  symbols?: Manifold;
  capHeight?: number;
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function box(shape: CrossSection): Box {
  const b = shape.bounds();
  return { minX: b.min[0], maxX: b.max[0], minY: b.min[1], maxY: b.max[1] };
}

/**
 * Lay the symbols out in a row, left edge at x = 0 and centered on y = 0.
 * Variable-width symbols (bolts) share `variableBudget` mm between them.
 */
function symbolRow(
  wasm: ManifoldToplevel,
  symbols: LabelSymbol[],
  height: number,
  gap: number,
  variableBudget: number,
): CrossSection {
  const variableCount = symbols.filter(isVariableWidth).length;
  const each = variableCount ? variableBudget / variableCount : 0;
  const shapes: CrossSection[] = [];
  let x = 0;
  for (const sym of symbols) {
    const shape = renderSymbol(wasm, sym, height, each);
    const b = box(shape);
    shapes.push(shape.translate(x - b.minX, -(b.minY + b.maxY) / 2));
    x += b.maxX - b.minX + gap;
  }
  return wasm.CrossSection.union(shapes);
}

/** Total width of the fixed-size symbols and the gaps between all symbols. */
function fixedRowWidth(wasm: ManifoldToplevel, symbols: LabelSymbol[], height: number, gap: number): number {
  let width = gap * (symbols.length - 1);
  for (const sym of symbols) {
    if (isVariableWidth(sym)) continue;
    const b = box(renderSymbol(wasm, sym, height));
    width += b.maxX - b.minX;
  }
  return width;
}

/**
 * Lay out the symbols and text in the label's face area. Symbols sit at one
 * edge; the text fills the rest of the width.
 */
function layoutFace(wasm: ManifoldToplevel, font: Font, opts: LabelOptions) {
  const areaWidth = widthForUnits(opts.units) - 2 * opts.margin;
  const areaHeight = HEIGHT - 2 * opts.margin;
  const lines = opts.text.split("\n");
  const textLayout = (width: number) =>
    layoutText(wasm, font, {
      lines,
      align: opts.align,
      areaWidth: width,
      areaHeight,
      maxCapHeight: opts.maxCapHeight,
    });

  if (opts.symbols.length === 0) {
    const text = textLayout(areaWidth);
    return { text: text?.shape, capHeight: text?.capHeight };
  }

  const height = Math.min(opts.symbolSize, areaHeight);
  const gap = height * 0.2;
  const textGap = Math.max(1, height * 0.15);

  // Bolts get whatever the text leaves at its full size, but never less
  // than a third of the label, so they don't collapse to a stub.
  const natural = textLayout(1e4);
  const fixed = fixedRowWidth(wasm, opts.symbols, height, gap);
  let budget: number;
  if (natural) {
    const b = box(natural.shape);
    budget = Math.max(areaWidth - fixed - textGap - (b.maxX - b.minX), areaWidth / 3);
  } else {
    budget = areaWidth - fixed;
  }

  let row = symbolRow(wasm, opts.symbols, height, gap, budget);
  let rb = box(row);
  // Shrink the row if it is too tall (the Cullenect bolt is taller than the
  // row height) or leaves too little room for the text.
  const maxRowWidth = natural ? areaWidth * 0.7 : areaWidth;
  const fit = Math.min(1, areaHeight / (rb.maxY - rb.minY), maxRowWidth / (rb.maxX - rb.minX));
  if (fit < 1) {
    row = row.scale(fit);
    rb = box(row);
  }
  const rowWidth = rb.maxX - rb.minX;

  const left = opts.symbolPosition === "left";
  if (!natural) {
    return { symbols: row.translate(-rowWidth / 2 - rb.minX, 0) };
  }

  const textWidth = areaWidth - rowWidth - textGap;
  const text = textLayout(textWidth)!;
  const textCenter = left ? areaWidth / 2 - textWidth / 2 : -areaWidth / 2 + textWidth / 2;
  const rowX = left ? -areaWidth / 2 : areaWidth / 2 - rowWidth;
  return {
    text: text.shape.translate(textCenter, 0),
    symbols: row.translate(rowX - rb.minX, 0),
    capHeight: text.capHeight,
  };
}

/**
 * Build the label as separate solids (body, text, symbols), so they can be
 * given different colours in the preview and in the exported 3MF.
 */
export function buildLabel(wasm: ManifoldToplevel, font: Font, opts: LabelOptions): LabelParts {
  let base = cullenectBody(wasm, { units: opts.units, ribs: opts.ribs });
  const face = layoutFace(wasm, font, opts);

  const depth = opts.style === "embedded" ? Math.min(opts.textDepth, maxEmbeddedDepth(opts)) : opts.textDepth;
  // Flush: cut the shape out of the base and fill the hole. Raised: stand it on the face.
  const solid = (shape: CrossSection | undefined) => {
    if (!shape || shape.isEmpty()) return undefined;
    const extruded = shape.extrude(depth);
    if (opts.style === "raised") return extruded;
    const inlay = extruded.translate(0, 0, -depth);
    base = base.subtract(inlay);
    return inlay;
  };

  const text = solid(face.text);
  const symbols = solid(face.symbols);
  return { base, text, symbols, capHeight: face.capHeight };
}

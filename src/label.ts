import type { Font } from "opentype.js";
import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import { cullenectBody, HEIGHT, widthForUnits } from "./cullenect";
import { isVariableWidth, renderSymbol, type LabelSymbol } from "./symbols";
import { textBlock, type Align } from "./text";

export type LabelStyle = "embedded" | "raised";

/** A piece of text on the label. "\n" starts a new line within it. */
export interface TextSegment {
  kind: "text";
  text: string;
}

/** What goes on the label, left to right: text and symbols in any order. */
export type Segment = TextSegment | LabelSymbol;

export function isText(segment: Segment): segment is TextSegment {
  return segment.kind === "text";
}

export interface LabelOptions {
  units: number;
  ribs: boolean;
  segments: Segment[];
  /**
   * Where text sits in the room it is given, and how its lines line up.
   * With symbols only, where the row sits on the label.
   */
  align: Align;
  maxCapHeight: number;
  margin: number;
  style: LabelStyle;
  /** Depth of embedded text, or height of raised text, in mm. */
  textDepth: number;
  /** Row height for the symbols, in mm. Symbols shrink below this to fit. */
  symbolSize: number;
}

export const DEFAULT_OPTIONS: LabelOptions = {
  units: 1,
  ribs: true,
  segments: [{ kind: "text", text: "M3 × 12" }],
  align: "center",
  maxCapHeight: 6,
  margin: 0.8,
  style: "embedded",
  textDepth: 0.2,
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

function size(shape: CrossSection): { width: number; height: number } {
  const { min, max } = shape.bounds();
  return { width: max[0] - min[0], height: max[1] - min[1] };
}

/** Center a shape on the origin. */
function centered(shape: CrossSection): CrossSection {
  const { min, max } = shape.bounds();
  return shape.translate(-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2);
}

type Item = { text: true; shape: CrossSection } | { text: false; symbol: LabelSymbol };

/**
 * Lay out the segments in a row across the label's face area. Symbols keep
 * their size; text shares the rest of the width, all at one letter height,
 * and is placed in its share by `align`.
 */
function layoutFace(wasm: ManifoldToplevel, font: Font, opts: LabelOptions) {
  const areaWidth = widthForUnits(opts.units) - 2 * opts.margin;
  const areaHeight = HEIGHT - 2 * opts.margin;

  // Text at a cap height of 1 mm; empty text takes no room.
  const items: Item[] = [];
  for (const seg of opts.segments) {
    if (!isText(seg)) items.push({ text: false, symbol: seg });
    else {
      const shape = textBlock(wasm, font, seg.text, opts.align);
      if (shape) items.push({ text: true, shape });
    }
  }
  if (items.length === 0) return {};

  const texts = items.filter((it) => it.text);
  const symbols = items.filter((it) => !it.text);
  const height = Math.min(opts.symbolSize, areaHeight);
  const symbolGap = height * 0.2;
  const textGap = Math.max(1, height * 0.15);
  const gaps = items.slice(1).map((it, i) => (it.text || items[i].text ? textGap : symbolGap));
  const gapWidth = gaps.reduce((a, b) => a + b, 0);
  const symbolGapWidth = gaps.filter((_, i) => !items[i].text && !items[i + 1].text).reduce((a, b) => a + b, 0);

  const textInk = texts.map((it) => size(it.shape));
  const inkWidth = textInk.reduce((a, b) => a + b.width, 0);
  const maxCap = Math.min(opts.maxCapHeight, ...textInk.map((b) => areaHeight / b.height));

  // Bolts get whatever the text leaves at its full size, but never less
  // than a third of the label, so they don't collapse to a stub.
  const fixedWidth = symbols
    .filter((it) => !isVariableWidth(it.symbol))
    .reduce((w, it) => w + size(renderSymbol(wasm, it.symbol, height)).width, 0);
  const budget = texts.length
    ? Math.max(areaWidth - fixedWidth - gapWidth - maxCap * inkWidth, areaWidth / 3)
    : areaWidth - fixedWidth - gapWidth;
  const variableCount = symbols.filter((it) => isVariableWidth(it.symbol)).length;
  const each = variableCount ? budget / variableCount : 0;

  // Shrink the symbols if they are too tall (the Cullenect bolt is taller
  // than the row height) or leave too little room for the text.
  let shapes = items.map((it) => (it.text ? it.shape : centered(renderSymbol(wasm, it.symbol, height, each))));
  const symbolShapes = shapes.filter((_, i) => !items[i].text);
  const symbolWidth = symbolShapes.reduce((w, s) => w + size(s).width, 0);
  const symbolHeight = Math.max(0, ...symbolShapes.map((s) => size(s).height));
  const symbolRoom = Math.max((texts.length ? areaWidth * 0.7 : areaWidth) - symbolGapWidth, areaWidth * 0.2);
  const fit = symbols.length ? Math.min(1, areaHeight / symbolHeight, symbolRoom / symbolWidth) : 1;

  const textRoom = Math.max(areaWidth - symbolWidth * fit - gapWidth, areaWidth * 0.1);
  let capHeight = texts.length ? Math.min(maxCap, textRoom / inkWidth) : undefined;
  shapes = shapes.map((s, i) => s.scale(items[i].text ? capHeight! : fit));

  // Spare width goes to the text, shared evenly; with no text it is left
  // around the row, as `align` says.
  const widths = shapes.map((s) => size(s).width);
  const total = widths.reduce((a, b) => a + b, 0) + gapWidth;
  const spare = Math.max(0, areaWidth - total);
  const share = texts.length ? spare / texts.length : 0;
  const rowWidth = total + share * texts.length;
  let x =
    texts.length || opts.align === "center"
      ? -rowWidth / 2
      : opts.align === "left"
        ? -areaWidth / 2
        : areaWidth / 2 - rowWidth;

  const placed = shapes.map((s, i) => {
    const slot = widths[i] + (items[i].text ? share : 0);
    const pad = !items[i].text ? 0 : opts.align === "left" ? 0 : opts.align === "right" ? share : share / 2;
    const out = s.translate(x + pad + widths[i] / 2, 0);
    x += slot + (gaps[i] ?? 0);
    return out;
  });

  // Too many segments to fit: shrink the whole row, gaps and all.
  const overflow = Math.min(1, areaWidth / rowWidth);
  const union = (keep: boolean) => {
    const parts = placed.filter((_, i) => items[i].text === keep);
    return parts.length ? wasm.CrossSection.union(parts).scale(overflow) : undefined;
  };
  if (capHeight !== undefined) capHeight *= overflow;
  return { text: union(true), symbols: union(false), capHeight };
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

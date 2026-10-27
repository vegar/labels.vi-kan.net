import type { Font } from "opentype.js";
import type { Manifold, ManifoldToplevel } from "manifold-3d";
import { cullenectBody, HEIGHT, widthForUnits } from "./cullenect";
import { layoutText, type Align } from "./text";

export type LabelStyle = "embedded" | "raised";

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
  capHeight?: number;
}

/**
 * Build the label as two separate solids, so they can be given different
 * colours in the preview and in the exported 3MF.
 */
export function buildLabel(wasm: ManifoldToplevel, font: Font, opts: LabelOptions): LabelParts {
  let base = cullenectBody(wasm, { units: opts.units, ribs: opts.ribs });

  const layout = layoutText(wasm, font, {
    lines: opts.text.split("\n"),
    align: opts.align,
    areaWidth: widthForUnits(opts.units) - 2 * opts.margin,
    areaHeight: HEIGHT - 2 * opts.margin,
    maxCapHeight: opts.maxCapHeight,
  });
  if (!layout) return { base };

  let text: Manifold;
  if (opts.style === "embedded") {
    // Flush with the face: cut the text out of the base and fill the hole.
    const depth = Math.min(opts.textDepth, maxEmbeddedDepth(opts));
    text = layout.shape.extrude(depth).translate(0, 0, -depth);
    base = base.subtract(text);
  } else {
    text = layout.shape.extrude(opts.textDepth);
  }
  return { base, text, capHeight: layout.capHeight };
}

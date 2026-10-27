import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";

/**
 * Cullenect label body, ported from gflabel's `cullenect` base (v2.0.0),
 * which follows Cullen J Webb's swappable label system:
 * https://makerworld.com/en/models/446624
 *
 * Geometry is centered on the origin in X/Y with the label face at z = 0
 * and the body extending down to z = -DEPTH.
 */

export const HEIGHT = 11;
export const DEPTH = 1.2;
const CORNER_RADIUS = 0.5;
const EDGE_INSET = 0.2;
const RIB_POSITIONS = [-12.133, 0, 12.133];

/** Label width in mm for a bin that is `units` gridfinity units wide. */
export function widthForUnits(units: number): number {
  return units * 42 - 6;
}

export function roundedRect(
  wasm: ManifoldToplevel,
  width: number,
  height: number,
  radius: number,
): CrossSection {
  return wasm.CrossSection.square([width - 2 * radius, height - 2 * radius], true).offset(
    radius,
    "Round",
    2,
    32,
  );
}

export interface CullenectOptions {
  units: number;
  /** Cut the snap-fit channels on the back. gflabel only does this for 1U labels. */
  ribs: boolean;
}

export function cullenectBody(wasm: ManifoldToplevel, opts: CullenectOptions): Manifold {
  const width = widthForUnits(opts.units);
  const outline = roundedRect(wasm, width, HEIGHT, CORNER_RADIUS);
  let body = outline.extrude(DEPTH).translate(0, 0, -DEPTH);

  // A thin step around the outer edge, from z = -1.0 to z = -0.4.
  const ring = outline.subtract(
    roundedRect(wasm, width - 2 * EDGE_INSET, HEIGHT - 2 * EDGE_INSET, 0.3),
  );
  body = body.subtract(ring.extrude(DEPTH - 0.6).translate(0, 0, -(DEPTH - 0.2)));

  if (opts.ribs && opts.units === 1) {
    for (const x of RIB_POSITIONS) {
      // T-shaped channel running the full label height: a narrow slot
      // through the back, widening to a 2 mm channel 0.2 mm in.
      const length = HEIGHT + 2;
      const slot = wasm.Manifold.cube([1, length, 0.21], true).translate(x, 0, -DEPTH + 0.095);
      const wide = wasm.Manifold.cube([2, length, 0.6], true).translate(x, 0, -DEPTH + 0.5);
      const channel = slot.add(wide);
      body = body.subtract(channel);
    }
  }
  return body;
}

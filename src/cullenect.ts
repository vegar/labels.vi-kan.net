import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";

/**
 * Cullenect label bodies, ported from gflabel's `cullenect` base (v2.0.0 and
 * v1.1), which follows Cullen J Webb's swappable label system:
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

/** The v1.1 label: one size, for 1U bins only. */
export const LEGACY_WIDTH = 36.4;
const LEGACY_DEPTH = 1;

/**
 * Cullenect v1.1 label body (gflabel's `--version v1.1`). Thinner than v2,
 * without the edge step, and always with the three snap-fit channels.
 * gflabel's 0.5 mm fillets where the channels leave the edges are left out.
 */
export function cullenectLegacyBody(wasm: ManifoldToplevel): Manifold {
  let body = roundedRect(wasm, LEGACY_WIDTH, HEIGHT, CORNER_RADIUS)
    .extrude(LEGACY_DEPTH)
    .translate(0, 0, -LEGACY_DEPTH);
  for (const x of RIB_POSITIONS) {
    // The same T-shaped channel as v2, 0.2 mm higher up the thinner body.
    // The lip between its narrow and wide part is chamfered (0.1 mm across,
    // the full 0.2 mm down), so the slot widens from 1 mm at the back.
    const profile = new wasm.CrossSection([
      [
        [x - 0.5, -1.01],
        [x + 0.5, -1.01],
        [x + 0.5, -1],
        [x + 0.6, -0.8],
        [x + 1, -0.8],
        [x + 1, -0.4],
        [x - 1, -0.4],
        [x - 1, -0.8],
        [x - 0.6, -0.8],
        [x - 0.5, -1],
      ],
    ]);
    // Profile drawn in x/z, run along y through the whole label.
    const channel = profile.extrude(HEIGHT + 2, 0, 0, [1, 1], true).rotate([90, 0, 0]);
    body = body.subtract(channel);
  }
  return body;
}

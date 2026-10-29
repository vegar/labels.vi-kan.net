import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import { roundedRect } from "./cullenect";

/**
 * Pred label body, ported from gflabel's `pred` base, for pred's parametric
 * Gridfinity bins with printable labels:
 * https://www.printables.com/model/592545
 *
 * A thin plate with a tab and a round hole at each end. Geometry is centered
 * on the origin in X/Y with the label face at z = 0.
 */

/**
 * gflabel makes pred labels 11.5 mm tall, but Gridfinity Extended's pred
 * pocket is only 11.35 mm (its default 14 mm label size less the 2.65 mm
 * lip). 11 mm fits both, with the same clearance as a Cullenect label.
 */
export const PRED_HEIGHT = 11;
export const PRED_DEPTH = 0.8;
/** How deep the face sits below the rim on a recessed label. */
const RECESS = 0.4;
const TAB_HEIGHT = 5.7;
const HOLE_RADIUS = 0.75;

/** Label width in mm for a bin that is `units` gridfinity units wide. */
export function predWidthForUnits(units: number): number {
  return units * 42 - 4.2;
}

/** The face inside the rim and clear of the holes, as gflabel lays out text. */
export function predArea(units: number): { width: number; height: number } {
  return { width: predWidthForUnits(units) - 5.5, height: PRED_HEIGHT - 1 };
}

function outline(wasm: ManifoldToplevel, width: number): CrossSection {
  const { CrossSection } = wasm;
  const body = roundedRect(wasm, width - 2, PRED_HEIGHT, 0.9);
  const tabs = CrossSection.square([width, TAB_HEIGHT], true);
  const hole = CrossSection.circle(HOLE_RADIUS, 32);
  const x = width / 2 - 1.5;
  return body.add(tabs).subtract(hole.translate(-x, 0)).subtract(hole.translate(x, 0));
}

/**
 * The recessed face: the label less a 0.5 mm rim, cut around each hole with
 * a 1.25 mm radius and rounded where that meets the straight edge.
 */
function recess(wasm: ManifoldToplevel, width: number): CrossSection {
  const { CrossSection } = wasm;
  const x = width / 2 - 1.5;
  const bite = CrossSection.circle(1.25, 32);
  // Round the corners next to the holes by opening the shape with a 1 mm
  // circle; draw it taller than needed so the outer corners keep their own,
  // smaller radius when trimmed to the label.
  const cut = CrossSection.square([2 * x, PRED_HEIGHT + 4], true)
    .subtract(bite.translate(-x, 0))
    .subtract(bite.translate(x, 0))
    .offset(-1, "Round", 2, 32)
    .offset(1, "Round", 2, 32);
  return cut.intersect(roundedRect(wasm, 2 * x, PRED_HEIGHT - 1, 0.4));
}

export interface PredOptions {
  units: number;
  /**
   * Sink the face 0.4 mm below a rim, as gflabel does for raised text, so
   * the text sits within the rim. Otherwise the top is flat.
   */
  recessed: boolean;
}

/**
 * The body runs from z = -0.8 to the face at z = 0; a recessed one from
 * -0.4, with the rim standing 0.4 above the face. gflabel's 0.2 mm fillets
 * on the top and bottom edges are left out.
 */
export function predBody(wasm: ManifoldToplevel, opts: PredOptions): Manifold {
  const width = predWidthForUnits(opts.units);
  const body = outline(wasm, width).extrude(PRED_DEPTH).translate(0, 0, -PRED_DEPTH);
  if (!opts.recessed) return body;
  return body.translate(0, 0, RECESS).subtract(recess(wasm, width).extrude(RECESS + 0.01));
}

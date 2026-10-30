import type { Manifold, ManifoldToplevel } from "manifold-3d";
import { buildLabel, type Fonts, type LabelOptions } from "../src/label";

/** Build a label and join its segments by kind, as the tests check text and symbols as wholes. */
export function buildByKind(wasm: ManifoldToplevel, fonts: Fonts, opts: LabelOptions) {
  const parts = buildLabel(wasm, fonts, opts);
  const join = (kind: "text" | "symbol"): Manifold | undefined => {
    const solids = parts.segments.filter((s) => s.kind === kind).map((s) => s.manifold);
    return solids.length ? wasm.Manifold.compose(solids) : undefined;
  };
  return { ...parts, text: join("text"), symbols: join("symbol") };
}

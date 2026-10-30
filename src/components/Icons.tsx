import { useMemo } from "react";
import type { ManifoldToplevel } from "manifold-3d";
import { renderSymbol, toSvgPath, type LabelSymbol } from "../symbols";

/** A small drawing of a symbol, rendered with the same geometry as the label. */
export function SymbolIcon({ wasm, symbol }: { wasm: ManifoldToplevel; symbol: LabelSymbol }) {
  // Keyed by content, so icons for symbols built inline don't redraw on every render.
  const key = JSON.stringify(symbol);
  const icon = useMemo(() => {
    const shape = renderSymbol(wasm, symbol, 10, 24);
    const { min, max } = shape.bounds();
    const path = toSvgPath(shape);
    shape.delete();
    const pad = 1;
    return {
      path,
      viewBox: `${min[0] - pad} ${-max[1] - pad} ${max[0] - min[0] + 2 * pad} ${max[1] - min[1] + 2 * pad}`,
    };
  }, [wasm, key]);
  return (
    <svg className="symbol-icon" viewBox={icon.viewBox} aria-hidden="true">
      <path d={icon.path} fillRule="evenodd" />
    </svg>
  );
}

/** A small "T" for text segments, sized like the symbol icons. */
export function TextIcon() {
  return (
    <svg className="symbol-icon" viewBox="0 0 24 12" aria-hidden="true">
      <text x="12" y="10.5" textAnchor="middle" fontSize="12" fontWeight="700">
        Aa
      </text>
    </svg>
  );
}

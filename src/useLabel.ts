import { useEffect, useMemo, useRef } from "react";
import { buildLabel, type LabelParts } from "./label";
import type { LabelState } from "./state";
import type { Engine } from "./useEngine";

export interface BuildResult {
  parts?: LabelParts;
  error?: string;
  ms?: number;
}

/**
 * Build the label geometry from the current state. Colours don't affect
 * geometry, so changing them does not trigger a rebuild.
 */
export function useLabel(engine: Engine | undefined, state: LabelState): BuildResult {
  const { units, ribs, text, align, maxCapHeight, margin, style, textDepth, symbols, symbolPosition, symbolSize, weight } =
    state;

  const result = useMemo<BuildResult>(() => {
    if (!engine) return {};
    const started = performance.now();
    try {
      const parts = buildLabel(engine.wasm, engine.fonts[weight], {
        units,
        ribs,
        text,
        align,
        maxCapHeight,
        margin,
        style,
        textDepth,
        symbols,
        symbolPosition,
        symbolSize,
      });
      return { parts, ms: Math.round(performance.now() - started) };
    } catch (err) {
      return { error: String(err) };
    }
  }, [
    engine,
    units,
    ribs,
    text,
    align,
    maxCapHeight,
    margin,
    style,
    textDepth,
    symbols,
    symbolPosition,
    symbolSize,
    weight,
  ]);

  // Manifolds live in WASM memory and must be freed by hand. Free the previous
  // build once a new one has been committed, so nothing still renders it.
  const previous = useRef<LabelParts>(undefined);
  useEffect(() => {
    const old = previous.current;
    if (old && old !== result.parts) {
      old.base.delete();
      old.text?.delete();
      old.symbols?.delete();
    }
    previous.current = result.parts;
  }, [result.parts]);

  return result;
}

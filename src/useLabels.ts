import { useEffect, useMemo, useRef } from "react";
import { buildLabel, type LabelParts } from "./label";
import type { LabelState } from "./state";
import type { Engine } from "./useEngine";

export interface BuildResult {
  parts?: LabelParts;
  error?: string;
  ms?: number;
}

interface Built {
  /** The geometry inputs the parts were built from. */
  key: string;
  result: BuildResult;
}

/** Everything that changes a label's geometry. Colours and the id don't. */
function geometryKey(state: LabelState): string {
  const { base, units, ribs, segments, align, gap, margin, style, textDepth } = state;
  return JSON.stringify([base, units, ribs, segments, align, gap, margin, style, textDepth]);
}

function build(engine: Engine, state: LabelState): BuildResult {
  const started = performance.now();
  try {
    const parts = buildLabel(engine.wasm, engine.fonts, state);
    return { parts, ms: Math.round(performance.now() - started) };
  } catch (err) {
    return { error: String(err) };
  }
}

function free(parts: LabelParts | undefined) {
  parts?.base.delete();
  parts?.text?.delete();
  parts?.symbols?.delete();
}

/**
 * Build the geometry of every label, keyed by label id. Only labels whose
 * geometry inputs changed are rebuilt, so editing one label stays fast.
 */
export function useLabels(engine: Engine | undefined, labels: LabelState[]): Map<string, BuildResult> {
  // The latest builds, reused across renders (and across StrictMode's double
  // render, so that doesn't build twice).
  const cache = useRef(new Map<string, Built>());

  const results = useMemo(() => {
    const next = new Map<string, Built>();
    if (engine) {
      for (const label of labels) {
        const key = geometryKey(label);
        const cached = cache.current.get(label.id);
        next.set(label.id, cached?.key === key ? cached : { key, result: build(engine, label) });
      }
    }
    cache.current = next;
    return new Map([...next].map(([id, built]) => [id, built.result]));
  }, [engine, labels]);

  // Manifolds live in WASM memory and must be freed by hand. Free builds that
  // were replaced once the new ones are committed, so nothing still renders them.
  const committed = useRef(new Map<string, BuildResult>());
  useEffect(() => {
    const live = new Set([...results.values()].map((r) => r.parts));
    for (const old of committed.current.values()) {
      if (!live.has(old.parts)) free(old.parts);
    }
    committed.current = results;
  }, [results]);

  return results;
}

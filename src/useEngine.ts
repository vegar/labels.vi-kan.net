import { useEffect, useState } from "react";
import opentype, { type Font } from "opentype.js";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import type { ManifoldToplevel } from "manifold-3d";
import { loadManifold } from "./manifold";
import type { Weight } from "./state";

export interface Engine {
  wasm: ManifoldToplevel;
  fonts: Record<Weight, Font>;
}

export type EngineStatus = { engine: Engine; error?: undefined } | { engine?: undefined; error?: string };

async function loadFont(file: string): Promise<Font> {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  return opentype.parse(await res.arrayBuffer());
}

/** Load the geometry kernel and the bundled fonts once. */
export function useEngine(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadManifold(wasmUrl), loadFont("OpenSans-Regular.ttf"), loadFont("OpenSans-Bold.ttf")])
      .then(([wasm, regular, bold]) => !cancelled && setStatus({ engine: { wasm, fonts: { regular, bold } } }))
      .catch((err) => !cancelled && setStatus({ error: String(err) }));
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

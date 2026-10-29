import type { Manifold, ManifoldToplevel } from "manifold-3d";
import { cullenectBody, cullenectLegacyBody, HEIGHT, LEGACY_WIDTH, widthForUnits } from "./cullenect";
import { PRED_DEPTH, PRED_HEIGHT, predArea, predBody, predWidthForUnits } from "./pred";

/** The label holder the label is made for. */
export type BaseKind = "cullenect" | "cullenect-legacy" | "pred";

export const BASE_KINDS: BaseKind[] = ["cullenect", "cullenect-legacy", "pred"];

export interface BaseOptions {
  base: BaseKind;
  units: number;
  /** Snap-fit channels on a 1U Cullenect v2 label. */
  ribs: boolean;
  /** Raised text gets a recessed face on bases that have one (pred). */
  raised: boolean;
}

interface Size {
  width: number;
  height: number;
}

interface BaseInfo {
  name: string;
  /** Only made in one width, whatever the bin. */
  oneSize: boolean;
  size(units: number): Size;
  /** The part of the face text and symbols may use, before margins. */
  area(units: number): Size;
  /** Deepest flush text that leaves material over anything cut in the back. */
  maxEmbeddedDepth(opts: BaseOptions): number;
  body(wasm: ManifoldToplevel, opts: BaseOptions): Manifold;
}

const cullenect: BaseInfo = {
  name: "Cullenect",
  oneSize: false,
  size: (units) => ({ width: widthForUnits(units), height: HEIGHT }),
  area: (units) => ({ width: widthForUnits(units), height: HEIGHT }),
  // The channels' ceiling is 0.4 mm below the face.
  maxEmbeddedDepth: (opts) => (opts.ribs && opts.units === 1 ? 0.3 : 0.8),
  body: (wasm, opts) => cullenectBody(wasm, { units: opts.units, ribs: opts.ribs }),
};

const cullenectLegacy: BaseInfo = {
  name: "Cullenect legacy",
  oneSize: true,
  size: () => ({ width: LEGACY_WIDTH, height: HEIGHT }),
  area: () => ({ width: LEGACY_WIDTH, height: HEIGHT }),
  maxEmbeddedDepth: () => 0.3,
  body: (wasm) => cullenectLegacyBody(wasm),
};

const pred: BaseInfo = {
  name: "Pred",
  oneSize: false,
  size: (units) => ({ width: predWidthForUnits(units), height: PRED_HEIGHT }),
  area: predArea,
  maxEmbeddedDepth: () => PRED_DEPTH - 0.2,
  body: (wasm, opts) => predBody(wasm, { units: opts.units, recessed: opts.raised }),
};

const BASES: Record<BaseKind, BaseInfo> = {
  cullenect,
  "cullenect-legacy": cullenectLegacy,
  pred,
};

export function baseInfo(kind: BaseKind): BaseInfo {
  return BASES[kind] ?? cullenect;
}

export function isBaseKind(value: unknown): value is BaseKind {
  return BASE_KINDS.includes(value as BaseKind);
}

import { DEFAULT_OPTIONS, type LabelOptions } from "./label";

export type Weight = "regular" | "bold";

export interface LabelState extends LabelOptions {
  weight: Weight;
  baseColor: string;
  textColor: string;
  symbolColor: string;
}

const STORAGE_KEY = "gridfinity-labels:v1";

export const DEFAULT_STATE: LabelState = {
  ...DEFAULT_OPTIONS,
  weight: "bold",
  baseColor: "#1f2328",
  textColor: "#f4f4f0",
  symbolColor: "#f4f4f0",
  symbols: [{ kind: "screw", headShape: "countersunk", drives: ["phillips"] }],
};

/** The first release started with this bolt; swap it for the new default. */
const OLD_DEFAULT_SYMBOLS = JSON.stringify([{ kind: "cullbolt", headShape: "socket", drives: ["hex"] }]);

export function loadState(): LabelState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: LabelState = { ...DEFAULT_STATE, ...JSON.parse(saved) };
      if (!Array.isArray(state.symbols) || JSON.stringify(state.symbols) === OLD_DEFAULT_SYMBOLS) {
        state.symbols = DEFAULT_STATE.symbols;
      }
      return state;
    }
  } catch {
    // Storage can be unavailable (private windows, blocked site data).
  }
  return { ...DEFAULT_STATE };
}

export function saveState(state: LabelState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not critical; the label just won't be remembered.
  }
}

/** A file name based on the label text, e.g. "label-M3-12-1u". */
export function fileName(state: LabelState): string {
  const slug = state.text
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "")
    .slice(0, 40);
  return `label-${slug || "blank"}-${state.units}u`;
}

import { baseInfo, type BaseKind } from "../bases";
import type { LabelState } from "../state";

/** Below this letter height, text gets hard to read with a 0.4 mm nozzle. */
export const MIN_LEGIBLE_CAP_HEIGHT = 4.4;

export type Update = (patch: Partial<LabelState>) => void;

/** Picking a holder: the legacy label only comes in one size, for 1U bins. */
export function holderPatch(kind: BaseKind): Partial<LabelState> {
  return baseInfo(kind).oneSize ? { base: kind, units: 1 } : { base: kind };
}

import { useState } from "react";
import type { LabelState } from "../state";

/**
 * Which segment of the selected label is open, if any. Picking another label
 * (in the sidebar or the 3D view) goes back to the label itself.
 */
export function useSegmentSelection(
  state: LabelState,
): [number | undefined, (index: number | undefined, label?: string) => void] {
  const [picked, setPicked] = useState<{ label: string; index: number }>();
  const index = picked && picked.label === state.id && picked.index < state.segments.length ? picked.index : undefined;
  return [index, (i, label = state.id) => setPicked(i === undefined ? undefined : { label, index: i })];
}

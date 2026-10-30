import { useState } from "react";

/** Prototype sidebar layouts, to compare side by side with the same labels. */
export type UiVariant = "classic" | "tree" | "grid" | "accordion";

export const UI_VARIANTS: { value: UiVariant; name: string }[] = [
  { value: "classic", name: "Classic (current)" },
  { value: "tree", name: "Tree + property card" },
  { value: "grid", name: "Property grid" },
  { value: "accordion", name: "Compact accordion" },
];

const STORAGE_KEY = "gridfinity-labels:ui";

function isVariant(value: unknown): value is UiVariant {
  return UI_VARIANTS.some((v) => v.value === value);
}

/** ?ui= in the address wins, then the last one picked, then the current layout. */
function loadVariant(): UiVariant {
  const param = new URLSearchParams(location.search).get("ui");
  if (isVariant(param)) return param;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isVariant(stored)) return stored;
  } catch {
    // Storage can be unavailable (private windows, blocked site data).
  }
  return "classic";
}

/** The sidebar layout in use. Picking one updates ?ui= so the link can be shared. */
export function useUiVariant(): [UiVariant, (variant: UiVariant) => void] {
  const [variant, setVariant] = useState(loadVariant);
  const choose = (next: UiVariant) => {
    setVariant(next);
    const url = new URL(location.href);
    url.searchParams.set("ui", next);
    history.replaceState(null, "", url);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not critical.
    }
  };
  return [variant, choose];
}

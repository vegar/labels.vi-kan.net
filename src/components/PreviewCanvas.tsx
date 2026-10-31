import { useEffect, useRef } from "react";
import type { Bed } from "../bed";
import { Preview, type PreviewLabel, type RowLayout } from "../preview";

interface Props {
  labels: PreviewLabel[];
  selected: string;
  layout: RowLayout;
  /** Show the labels on this printer's plates instead of in a row. */
  bed: Bed | null;
  /** Called when a label is clicked in the view. */
  onSelect: (id: string) => void;
}

/** React wrapper around the three.js preview. */
export function PreviewCanvas({ labels, selected, layout, bed, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const preview = useRef<Preview>(null);
  // The preview lives for the component's lifetime, so it calls the latest handler through a ref.
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    const p = new Preview(container.current!);
    preview.current = p;
    p.onPick = (id) => select.current(id);
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const syncBackground = () => p.setBackground(dark.matches ? "#17191c" : "#eef0f2");
    syncBackground();
    dark.addEventListener("change", syncBackground);
    return () => {
      dark.removeEventListener("change", syncBackground);
      p.dispose();
      preview.current = null;
    };
  }, []);

  useEffect(() => {
    preview.current?.update(labels, selected, layout, bed);
  }, [labels, selected, layout, bed]);

  return <div id="preview" ref={container} />;
}

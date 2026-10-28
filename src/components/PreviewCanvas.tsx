import { useEffect, useRef } from "react";
import { Preview, type PreviewLabel, type RowLayout } from "../preview";

interface Props {
  labels: PreviewLabel[];
  selected: string;
  layout: RowLayout;
}

/** React wrapper around the three.js preview. */
export function PreviewCanvas({ labels, selected, layout }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const preview = useRef<Preview>(null);

  useEffect(() => {
    const p = new Preview(container.current!);
    preview.current = p;
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
    preview.current?.update(labels, selected, layout);
  }, [labels, selected, layout]);

  return <div id="preview" ref={container} />;
}

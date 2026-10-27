import { useEffect, useRef } from "react";
import { Preview } from "../preview";
import type { LabelParts } from "../label";

interface Props {
  parts?: LabelParts;
  width: number;
  baseColor: string;
  textColor: string;
  symbolColor: string;
}

/** React wrapper around the three.js preview. */
export function PreviewCanvas({ parts, width, baseColor, textColor, symbolColor }: Props) {
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
    if (!parts) return;
    preview.current?.update(
      [
        { manifold: parts.base, color: baseColor },
        ...(parts.text ? [{ manifold: parts.text, color: textColor }] : []),
        ...(parts.symbols ? [{ manifold: parts.symbols, color: symbolColor }] : []),
      ],
      width,
    );
  }, [parts, width, baseColor, textColor, symbolColor]);

  return <div id="preview" ref={container} />;
}

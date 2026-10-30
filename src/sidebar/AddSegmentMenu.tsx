import { useRef } from "react";
import type { ManifoldToplevel } from "manifold-3d";
import type { Segment } from "../label";
import { SYMBOLS } from "../symbols";
import { SymbolIcon, TextIcon } from "../components/Icons";
import { newSegment } from "../components/segmentOps";

/** A "+ Add" button that opens the text and symbol palette. */
export function AddSegmentMenu({
  wasm,
  segments,
  onAdd,
  label = "+ Add segment",
}: {
  wasm?: ManifoldToplevel;
  /** The label's segments; new ones copy the style of the last of their kind. */
  segments: Segment[];
  onAdd: (seg: Segment) => void;
  label?: string;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const add = (seg: Segment) => {
    onAdd(seg);
    menu.current!.open = false;
  };
  return (
    <details className="add-menu" ref={menu}>
      <summary>{label}</summary>
      <div className="symbol-palette">
        <button type="button" title="Add text" onClick={() => add(newSegment("text", segments))}>
          <TextIcon />
          <span>Text</span>
        </button>
        {SYMBOLS.map((info) => (
          <button
            key={info.kind}
            type="button"
            title={`Add ${info.name.toLowerCase()}`}
            disabled={!wasm}
            onClick={() => add(newSegment(info.kind, segments))}
          >
            {wasm && <SymbolIcon wasm={wasm} symbol={info.defaults} />}
            <span>{info.name}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

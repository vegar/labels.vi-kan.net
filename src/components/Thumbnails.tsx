import { useMemo } from "react";
import type { CrossSection, Manifold } from "manifold-3d";
import { isText, type Segment } from "../label";
import type { LabelState } from "../state";
import { renderSymbol, toSvgPath } from "../symbols";
import { textBlock } from "../text";
import type { Engine } from "../useEngine";
import type { BuildResult } from "../useLabels";

interface Outline {
  d: string;
  min: [number, number];
  max: [number, number];
}

function outline(shape: CrossSection): Outline {
  const { min, max } = shape.bounds();
  return { d: toSvgPath(shape), min: [min[0], min[1]], max: [max[0], max[1]] };
}

/** The label seen from the front, as a 2D outline. */
function project(m: Manifold | undefined): Outline | undefined {
  if (!m) return undefined;
  const shape = m.project();
  const result = outline(shape);
  shape.delete();
  return result;
}

function viewBox({ min, max }: Outline, pad: number) {
  return `${min[0] - pad} ${-max[1] - pad} ${max[0] - min[0] + 2 * pad} ${max[1] - min[1] + 2 * pad}`;
}

/** Thumbnails share one scale, so a 2U label looks twice as wide as a 1U one. */
const PX_PER_MM = 3.4;

/** The whole label, drawn from its built geometry in the label's colours. */
export function LabelThumb({ label, build }: { label: LabelState; build?: BuildResult }) {
  const parts = build?.parts;
  const drawing = useMemo(
    () => parts && { base: project(parts.base)!, text: project(parts.text), symbols: project(parts.symbols) },
    [parts],
  );
  if (!drawing) return <div className="label-thumb loading" />;
  return (
    <svg
      className="label-thumb"
      viewBox={viewBox(drawing.base, 0.4)}
      style={{ width: `min(100%, ${(drawing.base.max[0] - drawing.base.min[0]) * PX_PER_MM}px)` }}
      aria-hidden="true"
    >
      <path d={drawing.base.d} fill={label.baseColor} fillRule="evenodd" stroke="var(--border)" strokeWidth={0.3} />
      {drawing.text && <path d={drawing.text.d} fill={label.textColor} fillRule="evenodd" />}
      {drawing.symbols && <path d={drawing.symbols.d} fill={label.symbolColor} fillRule="evenodd" />}
    </svg>
  );
}

/** One segment on its own: the text in the label's font, or the symbol. */
export function SegmentThumb({ engine, label, segment }: { engine?: Engine; label: LabelState; segment: Segment }) {
  const drawing = useMemo(() => {
    if (!engine) return undefined;
    const shape = isText(segment)
      ? textBlock(engine.wasm, engine.fonts[segment.weight], segment.text, segment.align)
      : renderSymbol(engine.wasm, segment, 10, 24);
    if (!shape) return undefined;
    const result = outline(shape);
    shape.delete();
    return result;
  }, [engine, segment]);
  const color = isText(segment) ? label.textColor : label.symbolColor;
  return (
    <span className="segment-thumb" style={{ background: label.baseColor }}>
      {drawing ? (
        <svg viewBox={viewBox(drawing, isText(segment) ? 0.15 : 0.6)} aria-hidden="true">
          <path d={drawing.d} fill={color} fillRule="evenodd" />
        </svg>
      ) : (
        <span className="empty">empty</span>
      )}
    </span>
  );
}

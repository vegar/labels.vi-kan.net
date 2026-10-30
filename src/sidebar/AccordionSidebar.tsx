import { useState, type ReactNode } from "react";
import { baseInfo } from "../bases";
import { HolderFields, PrintStyleFields, RowFields, ShrunkWarning } from "../components/LabelFields";
import { LabelList } from "../components/LabelList";
import { SymbolIcon, SymbolSegmentFields, TextIcon, TextOptions } from "../components/SegmentEditor";
import { moveSegment, removeSegment, replaceSegment, segmentName, segmentSummary } from "../components/segmentOps";
import { isText, type Segment } from "../label";
import { addLabel, blankLabel, cloneLabel, removeLabel } from "../state";
import { AddSegmentMenu } from "./AddSegmentMenu";
import type { SidebarProps } from "./types";
import { useSegmentSelection } from "./useSegmentSelection";

/** A section that folds to one line, with a summary of its settings. */
function Fold({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="fold" data-open={open || undefined}>
      <button type="button" className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="twisty">{open ? "▾" : "▸"}</span>
        <h2>{title}</h2>
        {!open && summary && <span className="fold-summary">{summary}</span>}
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
  );
}

/**
 * The current sections, folded to one-line summaries. Segments fold too, and
 * only one is open at a time.
 */
export function AccordionSidebar(props: SidebarProps) {
  const { session, setSession, state, update, engine, textDepth, maxDepth, shrunk } = props;
  const [segment, selectSegment] = useSegmentSelection(state);
  const base = baseInfo(state.base);
  const size = base.size(state.units);
  const setSegments = (segments: Segment[]) => update({ segments });
  const replace = (i: number, seg: Segment) => setSegments(replaceSegment(state.segments, i, seg));

  return (
    <>
      <Fold title={`Labels (${session.labels.length})`} defaultOpen>
        <LabelList
          labels={session.labels}
          selected={state.id}
          onSelect={(id) => setSession((s) => ({ ...s, selected: id }))}
          onAdd={() => setSession((s) => addLabel(s, blankLabel(state)))}
          onClone={(id, texts) => setSession((s) => cloneLabel(s, id, texts))}
          onRemove={(id) => setSession((s) => removeLabel(s, id))}
        />
      </Fold>

      <Fold
        title="Label"
        summary={`${base.name}${base.oneSize ? "" : ` · ${state.units}U`} · ${+size.width.toFixed(1)} × ${size.height} mm`}
      >
        <HolderFields state={state} update={update} />
      </Fold>

      <Fold title="Content" summary={`${state.segments.length} segments`} defaultOpen>
        <ol className="fold-list">
          {state.segments.map((seg, i) => {
            const open = segment === i;
            return (
              <li key={i} data-open={open || undefined}>
                <div className="fold-row">
                  <button
                    type="button"
                    className="fold-pick"
                    aria-expanded={open}
                    onClick={() => selectSegment(open ? undefined : i)}
                  >
                    {isText(seg) ? <TextIcon /> : engine && <SymbolIcon wasm={engine.wasm} symbol={seg} />}
                    <strong>{segmentName(seg)}</strong>
                    <span className="fold-summary">{segmentSummary(seg)}</span>
                    {seg.grow && <em className="badge">grow</em>}
                  </button>
                  <div className="row-actions">
                    <button
                      type="button"
                      title="Move left"
                      disabled={i === 0}
                      onClick={() => setSegments(moveSegment(state.segments, i, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Move right"
                      disabled={i === state.segments.length - 1}
                      onClick={() => setSegments(moveSegment(state.segments, i, 1))}
                    >
                      ↓
                    </button>
                    <button type="button" title="Remove" onClick={() => setSegments(removeSegment(state.segments, i))}>
                      ✕
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="fold-row-body">
                    {isText(seg) ? (
                      <TextOptions seg={seg} onChange={(p) => replace(i, { ...seg, ...p })} />
                    ) : (
                      <SymbolSegmentFields
                        wasm={engine?.wasm}
                        seg={seg}
                        onChange={(p) => replace(i, { ...seg, ...p })}
                      />
                    )}
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!seg.grow}
                        onChange={(e) => replace(i, { ...seg, grow: e.target.checked })}
                      />
                      <span>Grow: take a share of the spare width</span>
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <AddSegmentMenu
          wasm={engine?.wasm}
          segments={state.segments}
          onAdd={(seg) => {
            setSegments([...state.segments, seg]);
            selectSegment(state.segments.length);
          }}
        />
        <RowFields state={state} update={update} />
        {shrunk && <ShrunkWarning />}
      </Fold>

      <Fold
        title="Print style"
        summary={
          <>
            {state.style === "embedded" ? "Flush" : "Raised"} {textDepth.toFixed(1)} mm{" "}
            {[state.baseColor, state.textColor, state.symbolColor].map((c, i) => (
              <span key={i} className="dot" style={{ background: c }} />
            ))}
          </>
        }
      >
        <PrintStyleFields state={state} update={update} textDepth={textDepth} maxDepth={maxDepth} />
      </Fold>

      <section className="export sticky">{props.exportButtons}</section>
    </>
  );
}

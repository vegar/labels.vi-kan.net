import { useState } from "react";
import { baseInfo } from "../bases";
import { CloneDialog } from "../components/CloneDialog";
import { HolderFields, PrintStyleFields, RowFields, ShrunkWarning } from "../components/LabelFields";
import { SymbolSegmentFields, TextOptions } from "../components/SegmentEditor";
import { moveSegment, removeSegment, replaceSegment, segmentName, segmentSummary } from "../components/segmentOps";
import { LabelThumb, SegmentThumb } from "../components/Thumbnails";
import { isText, type Segment } from "../label";
import { addLabel, blankLabel, cloneLabel, labelTitle, removeLabel, updateLabel, type LabelState } from "../state";
import { AddSegmentMenu } from "./AddSegmentMenu";
import type { SidebarProps } from "./types";
import { useSegmentSelection } from "./useSegmentSelection";

/**
 * Labels and their segments as a tree, each drawn as it will print, with one
 * property card below for whatever is selected.
 */
export function TreeSidebar(props: SidebarProps) {
  const { session, setSession, state, engine, builds } = props;
  const [segment, selectSegment] = useSegmentSelection(state);
  const [open, setOpen] = useState(() => new Set([state.id]));
  const [cloning, setCloning] = useState<LabelState>();

  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const selectLabel = (id: string, index?: number) => {
    setSession((s) => ({ ...s, selected: id }));
    selectSegment(index, id);
    setOpen((o) => (o.has(id) ? o : new Set(o).add(id)));
  };
  const setSegments = (label: LabelState, segments: Segment[]) =>
    setSession((s) => updateLabel(s, label.id, { segments }));

  return (
    <>
      <section className="tree-section">
        <h2>
          Labels <small>({session.labels.length})</small>
        </h2>
        <ul className="tree" role="tree">
          {session.labels.map((label) => {
            const expanded = open.has(label.id) || label.id === state.id;
            const current = label.id === state.id;
            return (
              <li key={label.id} role="treeitem" aria-expanded={expanded}>
                <div className="tree-row label-row" aria-selected={current && segment === undefined}>
                  <button
                    type="button"
                    className="twisty"
                    aria-label={expanded ? "Collapse" : "Expand"}
                    onClick={() => toggle(label.id)}
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                  <button
                    type="button"
                    className="tree-pick"
                    title={labelTitle(label)}
                    onClick={() => selectLabel(label.id)}
                  >
                    <LabelThumb label={label} build={builds.get(label.id)} />
                    <small>
                      {baseInfo(label.base).name} · {label.units}U
                    </small>
                  </button>
                  <div className="row-actions">
                    <button type="button" title="Clone with new texts" onClick={() => setCloning(label)}>
                      ⧉
                    </button>
                    <button
                      type="button"
                      title="Remove label"
                      disabled={session.labels.length === 1}
                      onClick={() => setSession((s) => removeLabel(s, label.id))}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {expanded && (
                  <ul role="group">
                    {label.segments.map((seg, i) => (
                      <li key={i} role="treeitem">
                        <div className="tree-row segment-row" aria-selected={current && segment === i}>
                          <button type="button" className="tree-pick" onClick={() => selectLabel(label.id, i)}>
                            <SegmentThumb engine={engine} label={label} segment={seg} />
                            <span className="segment-text">
                              <span>
                                {segmentName(seg)}
                                {seg.grow && <em className="badge">grow</em>}
                              </span>
                              {!isText(seg) && <small>{segmentSummary(seg)}</small>}
                            </span>
                          </button>
                          <div className="row-actions">
                            <button
                              type="button"
                              title="Move left"
                              disabled={i === 0}
                              onClick={() => setSegments(label, moveSegment(label.segments, i, -1))}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title="Move right"
                              disabled={i === label.segments.length - 1}
                              onClick={() => setSegments(label, moveSegment(label.segments, i, 1))}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              title="Remove segment"
                              onClick={() => setSegments(label, removeSegment(label.segments, i))}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                    <li>
                      <AddSegmentMenu
                        wasm={engine?.wasm}
                        segments={label.segments}
                        onAdd={(seg) => {
                          setSegments(label, [...label.segments, seg]);
                          selectLabel(label.id, label.segments.length);
                        }}
                      />
                    </li>
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <button type="button" className="add-label" onClick={() => setSession((s) => addLabel(s, blankLabel(state)))}>
          + Add label
        </button>
      </section>

      {segment === undefined ? (
        <LabelCard {...props} />
      ) : (
        <SegmentCard {...props} index={segment} onBack={() => selectSegment(undefined)} />
      )}

      <section className="export sticky">{props.exportButtons}</section>

      {cloning && (
        <CloneDialog
          source={cloning}
          onClone={(texts) => setSession((s) => cloneLabel(s, cloning.id, texts))}
          onClose={() => setCloning(undefined)}
        />
      )}
    </>
  );
}

function LabelCard({ state, update, textDepth, maxDepth, shrunk }: SidebarProps) {
  return (
    <section className="prop-card">
      <h2>
        Label <small>{labelTitle(state)}</small>
      </h2>
      <HolderFields state={state} update={update} />
      <h3>Row</h3>
      <RowFields state={state} update={update} />
      {shrunk && <ShrunkWarning />}
      <h3>Print style</h3>
      <PrintStyleFields state={state} update={update} textDepth={textDepth} maxDepth={maxDepth} />
    </section>
  );
}

function SegmentCard({ state, update, engine, index, onBack }: SidebarProps & { index: number; onBack: () => void }) {
  const seg = state.segments[index];
  const replace = (next: Segment) => update({ segments: replaceSegment(state.segments, index, next) });
  return (
    <section className="prop-card">
      <h2>
        <button type="button" className="crumb" onClick={onBack}>
          Label
        </button>{" "}
        › {segmentName(seg)}{" "}
        <small>
          {index + 1} of {state.segments.length}
        </small>
      </h2>
      {isText(seg) ? (
        <TextOptions seg={seg} onChange={(p) => replace({ ...seg, ...p })} />
      ) : (
        <SymbolSegmentFields wasm={engine?.wasm} seg={seg} onChange={(p) => replace({ ...seg, ...p })} />
      )}
      <label className="check">
        <input type="checkbox" checked={!!seg.grow} onChange={(e) => replace({ ...seg, grow: e.target.checked })} />
        <span>Grow: take a share of the spare width</span>
      </label>
    </section>
  );
}

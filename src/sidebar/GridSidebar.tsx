import { useState } from "react";
import { BASE_KINDS, baseInfo, type BaseKind } from "../bases";
import { CloneDialog } from "../components/CloneDialog";
import { holderPatch, MIN_LEGIBLE_CAP_HEIGHT } from "../components/LabelFields";
import { ALIGN_OPTIONS, MODIFIER_LABELS, NUT_TYPES, SymbolIcon, TextIcon } from "../components/SegmentEditor";
import {
  HEAD_LABELS,
  moveSegment,
  newSegment,
  removeSegment,
  replaceSegment,
  segmentName,
  segmentSummary,
} from "../components/segmentOps";
import { isText, type Segment, type Weight } from "../label";
import { addLabel, blankLabel, cloneLabel, labelTitle, removeLabel, type LabelState } from "../state";
import {
  DRIVES,
  SYMBOLS,
  symbolInfo,
  symbolModifiers,
  type LabelSymbol,
  type NutView,
  type ScrewStyle,
  type ScrewView,
  type SymbolKind,
} from "../symbols";
import { AddSegmentMenu } from "./AddSegmentMenu";
import { Category, Check, Note, NumberInput, Prop, PropertyGrid, Select } from "./PropertyGrid";
import type { SidebarProps } from "./types";
import { useSegmentSelection } from "./useSegmentSelection";

/**
 * A compact outline of labels and segments, one line each, above a classic
 * property grid: names on the left, dropdowns and number boxes on the right.
 */
export function GridSidebar(props: SidebarProps) {
  const { session, setSession, state, update, engine } = props;
  const [segment, selectSegment] = useSegmentSelection(state);
  const [cloning, setCloning] = useState<LabelState>();
  const selectLabel = (id: string, index?: number) => {
    setSession((s) => ({ ...s, selected: id }));
    selectSegment(index, id);
  };
  const setSegments = (segments: Segment[]) => update({ segments });

  return (
    <>
      <section>
        <h2>
          Structure <small>({session.labels.length} labels)</small>
        </h2>
        <ul className="outline">
          {session.labels.map((label) => {
            const current = label.id === state.id;
            return (
              <li key={label.id}>
                <div className="outline-row" aria-selected={current && segment === undefined}>
                  <button type="button" className="outline-pick" onClick={() => selectLabel(label.id)}>
                    <span className="swatch" style={{ background: label.baseColor, color: label.textColor }}>
                      {label.units}U
                    </span>
                    <span className="label-title">{labelTitle(label)}</span>
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
                {current && (
                  <ul>
                    {label.segments.map((seg, i) => (
                      <li key={i}>
                        <div className="outline-row child" aria-selected={segment === i}>
                          <button type="button" className="outline-pick" onClick={() => selectLabel(label.id, i)}>
                            {isText(seg) ? <TextIcon /> : engine && <SymbolIcon wasm={engine.wasm} symbol={seg} />}
                            <span className="label-title">{isText(seg) ? segmentSummary(seg) : segmentName(seg)}</span>
                          </button>
                          <div className="row-actions">
                            <button
                              type="button"
                              title="Move left"
                              disabled={i === 0}
                              onClick={() => setSegments(moveSegment(label.segments, i, -1))}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title="Move right"
                              disabled={i === label.segments.length - 1}
                              onClick={() => setSegments(moveSegment(label.segments, i, 1))}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              title="Remove segment"
                              onClick={() => setSegments(removeSegment(label.segments, i))}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                    <li className="child">
                      <AddSegmentMenu
                        wasm={engine?.wasm}
                        segments={label.segments}
                        onAdd={(seg) => {
                          setSegments([...label.segments, seg]);
                          selectSegment(label.segments.length);
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

      <section>
        <h2>
          Properties{" "}
          <small>{segment === undefined ? "Label" : `${segmentName(state.segments[segment])} ${segment + 1}`}</small>
        </h2>
        {segment === undefined ? <LabelGrid {...props} /> : <SegmentGrid {...props} index={segment} />}
      </section>

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

function LabelGrid({ state, update, textDepth, maxDepth, shrunk }: SidebarProps) {
  const base = baseInfo(state.base);
  const size = base.size(state.units);
  const growing = state.segments.some((s) => s.grow);
  return (
    <PropertyGrid>
      <Category title="Label holder">
        <Prop name="Holder">
          <Select<BaseKind>
            value={state.base}
            options={BASE_KINDS.map((kind) => ({ value: kind, label: baseInfo(kind).name }))}
            onChange={(kind) => update(holderPatch(kind))}
          />
        </Prop>
        <Prop name="Bin width">
          <Select
            value={state.units}
            disabled={base.oneSize}
            options={[1, 2, 3].map((u) => ({ value: u, label: `${u}U` }))}
            onChange={(units) => update({ units })}
          />
        </Prop>
        <Prop name="Size">
          <span className="readonly">
            {+size.width.toFixed(1)} × {size.height} mm
          </span>
        </Prop>
        {state.base === "cullenect" && (
          <Prop name="Snap-fit channels" title="Channels on the back; 1U only">
            <Check checked={state.ribs} disabled={state.units !== 1} onChange={(ribs) => update({ ribs })} />
          </Prop>
        )}
      </Category>
      <Category title="Row">
        {!growing && (
          <Prop name="Row position" title="Where the row sits when no segment grows">
            <Select value={state.align} options={ALIGN_OPTIONS} onChange={(align) => update({ align })} />
          </Prop>
        )}
        {state.segments.length > 1 && (
          <Prop name="Gap">
            <NumberInput value={state.gap} min={0} max={5} step={0.1} onChange={(gap) => update({ gap })} />
          </Prop>
        )}
        {shrunk && <Note warn>Text was shrunk below {MIN_LEGIBLE_CAP_HEIGHT} mm to fit.</Note>}
      </Category>
      <Category title="Print">
        <Prop name="Style">
          <Select
            value={state.style}
            options={[
              { value: "embedded", label: "Flush" },
              { value: "raised", label: "Raised" },
            ]}
            onChange={(style) => update({ style })}
          />
        </Prop>
        <Prop name={state.style === "embedded" ? "Text depth" : "Text height"}>
          <NumberInput
            value={textDepth}
            min={0.1}
            max={maxDepth}
            step={0.1}
            onChange={(textDepth) => update({ textDepth })}
          />
        </Prop>
        <Prop name="Label colour">
          <input type="color" value={state.baseColor} onChange={(e) => update({ baseColor: e.target.value })} />
        </Prop>
        <Prop name="Text colour">
          <input type="color" value={state.textColor} onChange={(e) => update({ textColor: e.target.value })} />
        </Prop>
        <Prop name="Symbol colour">
          <input type="color" value={state.symbolColor} onChange={(e) => update({ symbolColor: e.target.value })} />
        </Prop>
      </Category>
    </PropertyGrid>
  );
}

const KIND_OPTIONS: { value: "text" | SymbolKind; label: string }[] = [
  { value: "text", label: "Text" },
  ...SYMBOLS.map((s) => ({ value: s.kind, label: s.name })),
];

function SegmentGrid({ state, update, index }: SidebarProps & { index: number }) {
  const seg = state.segments[index];
  const replace = (next: Segment) => update({ segments: replaceSegment(state.segments, index, next) });
  return (
    <PropertyGrid>
      <Category title="Segment">
        <Prop name="Type">
          <Select
            value={seg.kind}
            options={KIND_OPTIONS}
            onChange={(kind) => replace({ ...newSegment(kind, state.segments), grow: seg.grow })}
          />
        </Prop>
        <Prop name="Grow" title="Take a share of the spare width">
          <Check checked={!!seg.grow} onChange={(grow) => replace({ ...seg, grow })} />
        </Prop>
        {isText(seg) && (
          <Prop name="Text">
            <textarea
              rows={2}
              spellCheck={false}
              value={seg.text}
              onChange={(e) => replace({ ...seg, text: e.target.value })}
            />
          </Prop>
        )}
        {isText(seg) && (
          <>
            <Prop name="Align" title="How the lines line up, and where the text sits when it grows">
              <Select value={seg.align} options={ALIGN_OPTIONS} onChange={(align) => replace({ ...seg, align })} />
            </Prop>
            <Prop name="Weight">
              <Select<Weight>
                value={seg.weight}
                options={[
                  { value: "regular", label: "Regular" },
                  { value: "bold", label: "Bold" },
                ]}
                onChange={(weight) => replace({ ...seg, weight })}
              />
            </Prop>
            <Prop name="Max letter height">
              <NumberInput
                value={seg.maxCapHeight}
                min={2}
                max={9}
                step={0.1}
                onChange={(maxCapHeight) => replace({ ...seg, maxCapHeight })}
              />
            </Prop>
          </>
        )}
        {!isText(seg) && (
          <>
            <Prop name="Height">
              <NumberInput
                value={seg.size}
                min={3}
                max={9.4}
                step={0.1}
                onChange={(size) => replace({ ...seg, size })}
              />
            </Prop>
            {seg.grow && (
              <Prop name="Align" title="Where the symbol sits in its share of the spare width">
                <Select value={seg.align} options={ALIGN_OPTIONS} onChange={(align) => replace({ ...seg, align })} />
              </Prop>
            )}
          </>
        )}
      </Category>
      {!isText(seg) && <SymbolRows sym={seg} onChange={(p) => replace({ ...seg, ...p })} />}
    </PropertyGrid>
  );
}

/** The symbol's options as dropdowns and checkboxes, mirroring SymbolOptions. */
function SymbolRows({ sym, onChange }: { sym: LabelSymbol; onChange: (patch: Partial<LabelSymbol>) => void }) {
  const info = symbolInfo(sym.kind);
  const isScrew = sym.kind === "screw";
  const view = isScrew ? (sym.view ?? "both") : undefined;
  const showsDrive = view !== "side" || sym.style === "cullenect";
  const drives = sym.drives ?? [];
  const pin = drives.includes("security") ? (["security"] as const) : [];
  const drive = sym.hexHead ? "hexhead" : (drives.find((d) => d !== "security") ?? "none");
  const nutType = sym.nutType ?? "regular";
  const modifiers = symbolModifiers(sym);

  return (
    <Category title={info.name}>
      {isScrew && (
        <>
          <Prop name="Style">
            <Select<ScrewStyle>
              value={sym.style ?? "regular"}
              options={[
                { value: "regular", label: "Regular" },
                { value: "cullenect", label: "Cullenect" },
              ]}
              onChange={(style) => onChange({ style })}
            />
          </Prop>
          <Prop name="Show">
            <Select<ScrewView>
              value={view!}
              options={[
                { value: "both", label: "Drive and side" },
                { value: "drive", label: "Drive only" },
                { value: "side", label: "Side only" },
              ]}
              onChange={(view) => onChange({ view })}
            />
          </Prop>
        </>
      )}
      {sym.kind === "nut" && (
        <>
          <Prop name="Type">
            <Select value={nutType} options={NUT_TYPES} onChange={(nutType) => onChange({ nutType })} />
          </Prop>
          {nutType !== "square" && nutType !== "tnut" && (
            <Prop name="Show">
              <Select<NutView>
                value={sym.nutView ?? "top"}
                options={[
                  { value: "both", label: "Top and side" },
                  { value: "top", label: "Top only" },
                  { value: "side", label: "Side only" },
                ]}
                onChange={(nutView) => onChange({ nutView })}
              />
            </Prop>
          )}
        </>
      )}
      {info.drives && showsDrive && (
        <>
          <Prop name="Drive">
            <Select<string>
              value={drive}
              options={[
                { value: "none", label: "None" },
                ...DRIVES.filter((d) => d.value !== "security").map((d) => ({ value: d.value, label: d.label })),
                ...(isScrew ? [{ value: "hexhead", label: "Hex head bolt" }] : []),
              ]}
              onChange={(v) =>
                v === "hexhead"
                  ? onChange({ hexHead: true, drives: [] })
                  : onChange({ hexHead: false, drives: [...(v === "none" ? [] : [v as never]), ...pin] })
              }
            />
          </Prop>
          <Prop name="Security pin">
            <Check
              checked={drives.includes("security")}
              onChange={(on) =>
                onChange({
                  drives: [...drives.filter((d) => d !== "security"), ...(on ? (["security"] as const) : [])],
                })
              }
            />
          </Prop>
        </>
      )}
      {info.headShapes && !sym.hexHead && view !== "drive" && (
        <Prop name="Head">
          <Select
            value={sym.headShape ?? "pan"}
            options={info.headShapes.map((h) => ({ value: h, label: HEAD_LABELS[h] }))}
            onChange={(headShape) => onChange({ headShape })}
          />
        </Prop>
      )}
      {info.length && (
        <Prop name="Length">
          <NumberInput
            value={sym.length ?? 10}
            min={1}
            max={200}
            step={1}
            onChange={(length) => onChange({ length })}
          />
        </Prop>
      )}
      {modifiers.map((m) => (
        <Prop key={m} name={MODIFIER_LABELS[m]}>
          <Check checked={!!sym[m]} onChange={(on) => onChange({ [m]: on })} />
        </Prop>
      ))}
      {!info.drives && !info.headShapes && !info.length && sym.kind !== "nut" && modifiers.length === 0 && (
        <Note>No options.</Note>
      )}
    </Category>
  );
}

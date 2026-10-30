import { useMemo, type ReactNode } from "react";
import type { ManifoldToplevel } from "manifold-3d";
import {
  isText,
  symbolSegment,
  textSegment,
  type Segment,
  type SymbolSegment,
  type TextSegment,
  type Weight,
} from "../label";
import type { Align } from "../text";
import {
  DRIVES,
  renderSymbol,
  SYMBOLS,
  symbolInfo,
  symbolModifiers,
  toSvgPath,
  type Drive,
  type LabelSymbol,
  type NutType,
  type NutView,
  type ScrewStyle,
  type ScrewView,
} from "../symbols";
import { Segmented } from "./Segmented";
import { HEAD_LABELS } from "./segmentOps";

export const MODIFIER_LABELS = {
  tapping: "Self-tapping",
  partial: "Partly threaded",
  slotted: "Slotted",
  flanged: "Flanged",
  flip: "Flip",
};

export const NUT_TYPES: { value: NutType; label: string }[] = [
  { value: "regular", label: "Hex nut" },
  { value: "lock", label: "Lock nut" },
  { value: "square", label: "Square nut" },
  { value: "tnut", label: "T-nut" },
];

/** A small drawing of a symbol, rendered with the same geometry as the label. */
export function SymbolIcon({ wasm, symbol }: { wasm: ManifoldToplevel; symbol: LabelSymbol }) {
  // Keyed by content, so icons for symbols built inline don't redraw on every render.
  const key = JSON.stringify(symbol);
  const icon = useMemo(() => {
    const shape = renderSymbol(wasm, symbol, 10, 24);
    const { min, max } = shape.bounds();
    const path = toSvgPath(shape);
    shape.delete();
    const pad = 1;
    return {
      path,
      viewBox: `${min[0] - pad} ${-max[1] - pad} ${max[0] - min[0] + 2 * pad} ${max[1] - min[1] + 2 * pad}`,
    };
  }, [wasm, key]);
  return (
    <svg className="symbol-icon" viewBox={icon.viewBox} aria-hidden="true">
      <path d={icon.path} fillRule="evenodd" />
    </svg>
  );
}

/** The options of one symbol: style, drive, head and so on. */
export function SymbolOptions({
  wasm,
  sym,
  onChange,
}: {
  wasm?: ManifoldToplevel;
  sym: LabelSymbol;
  onChange: (patch: Partial<LabelSymbol>) => void;
}) {
  const info = symbolInfo(sym.kind);
  const isScrew = sym.kind === "screw";
  const view = isScrew ? (sym.view ?? "both") : undefined;
  // A regular screw's side view has no drive; a Cullenect one shows it in the head.
  const showsDrive = view !== "side" || sym.style === "cullenect";
  const modifiers = symbolModifiers(sym);
  // One drive at a time, plus an optional security pin (like Torx TR).
  // Picking the selected drive again removes it.
  const pickDrive = (drive: Drive) => {
    const drives = sym.drives ?? [];
    const pin = drives.includes("security") ? (["security"] as Drive[]) : [];
    onChange({ drives: [...(drives.includes(drive) ? [] : [drive]), ...pin], hexHead: false });
  };
  const toggleSecurity = (on: boolean) => {
    const drives = (sym.drives ?? []).filter((d) => d !== "security");
    onChange({ drives: on ? [...drives, "security"] : drives });
  };

  return (
    <>
      {isScrew && (
        <div className="row">
          <div className="field">
            <span>Style</span>
            <Segmented<ScrewStyle>
              value={sym.style ?? "regular"}
              options={[
                { value: "regular", label: "Regular" },
                { value: "cullenect", label: "Cullenect" },
              ]}
              onChange={(style) => onChange({ style })}
            />
          </div>
          <div className="field">
            <span>Show</span>
            <Segmented<ScrewView>
              value={view!}
              options={[
                { value: "both", label: "Both" },
                { value: "drive", label: "Drive" },
                { value: "side", label: "Side" },
              ]}
              onChange={(view) => onChange({ view })}
            />
          </div>
        </div>
      )}

      {sym.kind === "nut" && (
        <div className="row">
          <div className="field">
            <span>Type</span>
            <div className="icon-picker" role="group" aria-label="Nut type">
              {NUT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  title={t.label}
                  aria-pressed={(sym.nutType ?? "regular") === t.value}
                  onClick={() => onChange({ nutType: t.value })}
                >
                  {wasm && (
                    <SymbolIcon
                      wasm={wasm}
                      symbol={{ kind: "nut", nutType: t.value, nutView: t.value === "lock" ? "side" : "top" }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
          {(sym.nutType ?? "regular") !== "square" && sym.nutType !== "tnut" && (
            <div className="field">
              <span>Show</span>
              <Segmented<NutView>
                value={sym.nutView ?? "top"}
                options={[
                  { value: "both", label: "Both" },
                  { value: "top", label: "Top" },
                  { value: "side", label: "Side" },
                ]}
                onChange={(nutView) => onChange({ nutView })}
              />
            </div>
          )}
        </div>
      )}

      {info.drives && showsDrive && (
        <div className="field">
          <span>Drive</span>
          <div className="icon-picker" role="group" aria-label="Drive">
            {DRIVES.filter((d) => d.value !== "security").map((d) => (
              <button
                key={d.value}
                type="button"
                title={d.label}
                aria-pressed={!sym.hexHead && (sym.drives?.includes(d.value) ?? false)}
                onClick={() => pickDrive(d.value)}
              >
                {wasm && <SymbolIcon wasm={wasm} symbol={{ kind: "screw", view: "drive", drives: [d.value] }} />}
              </button>
            ))}
            {isScrew && (
              <button
                type="button"
                title="Hex head bolt"
                aria-pressed={!!sym.hexHead}
                onClick={() => onChange({ hexHead: !sym.hexHead, drives: [] })}
              >
                {wasm && <SymbolIcon wasm={wasm} symbol={{ kind: "screw", view: "drive", hexHead: true }} />}
              </button>
            )}
          </div>
        </div>
      )}

      {info.headShapes && !sym.hexHead && view !== "drive" && (
        <div className="field">
          <span>Head</span>
          <div className="icon-picker wide" role="group" aria-label="Head">
            {info.headShapes.map((h) => (
              <button
                key={h}
                type="button"
                title={HEAD_LABELS[h]}
                aria-pressed={(sym.headShape ?? "pan") === h}
                onClick={() => onChange({ headShape: h })}
              >
                {wasm && (
                  <SymbolIcon
                    wasm={wasm}
                    symbol={
                      isScrew
                        ? { kind: "screw", style: sym.style, view: "side", headShape: h, tapping: sym.tapping }
                        : { kind: "bolt", headShape: h, length: 14, tapping: sym.tapping }
                    }
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {info.length && (
        <label className="field inline">
          <span>Length (mm)</span>
          <input
            type="number"
            min={1}
            max={200}
            step={1}
            value={sym.length ?? 10}
            onChange={(e) => onChange({ length: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      )}

      {(modifiers.length > 0 || (info.drives && showsDrive)) && (
        <div className="row">
          {info.drives && showsDrive && (
            <label className="check">
              <input
                type="checkbox"
                checked={sym.drives?.includes("security") ?? false}
                onChange={(e) => toggleSecurity(e.target.checked)}
              />
              <span>Security pin</span>
            </label>
          )}
          {modifiers.map((m) => (
            <label key={m} className="check">
              <input type="checkbox" checked={!!sym[m]} onChange={(e) => onChange({ [m]: e.target.checked })} />
              <span>{MODIFIER_LABELS[m]}</span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}

/** A small "T" for text segments, sized like the symbol icons. */
export function TextIcon() {
  return (
    <svg className="symbol-icon" viewBox="0 0 24 12" aria-hidden="true">
      <text x="12" y="10.5" textAnchor="middle" fontSize="12" fontWeight="700">
        Aa
      </text>
    </svg>
  );
}

export const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

/** A labelled slider showing its value in mm. */
export function MmSlider(props: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>
        {props.label} <output>{props.value.toFixed(1)} mm</output>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={0.1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

/** Text, weight, alignment and letter height of a text segment. */
export function TextOptions({ seg, onChange }: { seg: TextSegment; onChange: (patch: Partial<TextSegment>) => void }) {
  return (
    <>
      <label className="field">
        <span>
          Text <small>(one line per row)</small>
        </span>
        <textarea rows={2} spellCheck={false} value={seg.text} onChange={(e) => onChange({ text: e.target.value })} />
      </label>
      <div className="row">
        <div className="field">
          <span>Align</span>
          <Segmented value={seg.align} options={ALIGN_OPTIONS} onChange={(align) => onChange({ align })} />
        </div>
        <div className="field">
          <span>Weight</span>
          <Segmented<Weight>
            value={seg.weight}
            options={[
              { value: "regular", label: "Regular" },
              { value: "bold", label: "Bold" },
            ]}
            onChange={(weight) => onChange({ weight })}
          />
        </div>
      </div>
      <MmSlider
        label="Max letter height"
        min={2}
        max={9}
        value={seg.maxCapHeight}
        onChange={(maxCapHeight) => onChange({ maxCapHeight })}
      />
    </>
  );
}

/** A symbol's options, plus where it sits when it grows and its height. */
export function SymbolSegmentFields({
  wasm,
  seg,
  onChange,
}: {
  wasm?: ManifoldToplevel;
  seg: SymbolSegment;
  onChange: (patch: Partial<SymbolSegment>) => void;
}) {
  return (
    <>
      <SymbolOptions wasm={wasm} sym={seg} onChange={onChange} />
      {seg.grow && (
        <div className="field">
          <span>Align</span>
          <Segmented value={seg.align} options={ALIGN_OPTIONS} onChange={(align) => onChange({ align })} />
        </div>
      )}
      <MmSlider label="Height" min={3} max={9.4} value={seg.size} onChange={(size) => onChange({ size })} />
    </>
  );
}

interface Props {
  wasm?: ManifoldToplevel;
  segments: Segment[];
  gap: number;
  align: Align;
  onChange: (patch: { segments?: Segment[]; gap?: number; align?: Align }) => void;
  /** Shown at the end of the section, e.g. a warning about the result. */
  children?: ReactNode;
}

/** What goes on the label, left to right: any mix of text and symbols. */
export function SegmentEditor({ wasm, segments, gap, align, onChange, children }: Props) {
  const setSegments = (next: Segment[]) => onChange({ segments: next });
  const replace = (i: number, seg: Segment) => setSegments(segments.map((s, j) => (j === i ? seg : s)));
  const move = (i: number, by: number) => {
    const next = [...segments];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    setSegments(next);
  };
  // New segments copy the style of the last one of their kind.
  const lastText = segments.filter(isText).at(-1);
  const lastSymbol = segments.filter((s): s is SymbolSegment => !isText(s)).at(-1);
  const growing = segments.some((s) => s.grow);

  return (
    <section>
      <h2>Content</h2>
      <p className="hint">
        Text and symbols, left to right on the label. Segments marked Grow share the spare width; without any, the row
        is packed together.
      </p>
      <div className="symbol-palette">
        <button type="button" title="Add text" onClick={() => setSegments([...segments, textSegment("", lastText)])}>
          <TextIcon />
          <span>Text</span>
        </button>
        {SYMBOLS.map((info) => (
          <button
            key={info.kind}
            type="button"
            title={`Add ${info.name.toLowerCase()}`}
            disabled={!wasm}
            onClick={() => setSegments([...segments, symbolSegment(info.defaults, lastSymbol)])}
          >
            {wasm && <SymbolIcon wasm={wasm} symbol={info.defaults} />}
            <span>{info.name}</span>
          </button>
        ))}
      </div>

      {segments.length > 0 && (
        <ol className="symbol-list">
          {segments.map((seg, i) => (
            <li key={i}>
              <div className="symbol-head">
                {isText(seg) ? <TextIcon /> : wasm && <SymbolIcon wasm={wasm} symbol={seg} />}
                <strong>{isText(seg) ? "Text" : symbolInfo(seg.kind).name}</strong>
                <label className="check grow" title="Take a share of the spare width">
                  <input
                    type="checkbox"
                    checked={!!seg.grow}
                    onChange={(e) => replace(i, { ...seg, grow: e.target.checked })}
                  />
                  <span>Grow</span>
                </label>
                <div className="symbol-actions">
                  <button type="button" title="Move left" disabled={i === 0} onClick={() => move(i, -1)}>
                    ←
                  </button>
                  <button
                    type="button"
                    title="Move right"
                    disabled={i === segments.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    →
                  </button>
                  <button type="button" title="Remove" onClick={() => setSegments(segments.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
              </div>
              {isText(seg) ? (
                <TextOptions seg={seg} onChange={(p) => replace(i, { ...seg, ...p })} />
              ) : (
                <SymbolSegmentFields wasm={wasm} seg={seg} onChange={(p) => replace(i, { ...seg, ...p })} />
              )}
            </li>
          ))}
        </ol>
      )}

      {segments.length > 0 && !growing && (
        <div className="field">
          <span>Row position</span>
          <Segmented value={align} options={ALIGN_OPTIONS} onChange={(align) => onChange({ align })} />
        </div>
      )}
      {segments.length > 1 && (
        <MmSlider label="Gap between segments" min={0} max={5} value={gap} onChange={(gap) => onChange({ gap })} />
      )}
      {children}
    </section>
  );
}

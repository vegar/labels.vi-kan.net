import { useMemo } from "react";
import type { ManifoldToplevel } from "manifold-3d";
import { isText, type Segment } from "../label";
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

const HEAD_LABELS = {
  pan: "Pan",
  socket: "Socket",
  countersunk: "Countersunk",
  round: "Round",
  wafer: "Wafer",
};

const MODIFIER_LABELS = {
  tapping: "Self-tapping",
  partial: "Partly threaded",
  slotted: "Slotted",
  flanged: "Flanged",
  flip: "Flip",
};

const NUT_TYPES: { value: NutType; label: string }[] = [
  { value: "regular", label: "Hex nut" },
  { value: "lock", label: "Lock nut" },
  { value: "square", label: "Square nut" },
  { value: "tnut", label: "T-nut" },
];

/** A small drawing of a symbol, rendered with the same geometry as the label. */
function SymbolIcon({ wasm, symbol }: { wasm: ManifoldToplevel; symbol: LabelSymbol }) {
  const icon = useMemo(() => {
    const shape = renderSymbol(wasm, symbol, 10, 24);
    const { min, max } = shape.bounds();
    const path = toSvgPath(shape);
    shape.delete();
    const pad = 1;
    return { path, viewBox: `${min[0] - pad} ${-max[1] - pad} ${max[0] - min[0] + 2 * pad} ${max[1] - min[1] + 2 * pad}` };
  }, [wasm, symbol]);
  return (
    <svg className="symbol-icon" viewBox={icon.viewBox} aria-hidden="true">
      <path d={icon.path} fillRule="evenodd" />
    </svg>
  );
}

/** The options of one symbol: style, drive, head and so on. */
function SymbolOptions({
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
function TextIcon() {
  return (
    <svg className="symbol-icon" viewBox="0 0 24 12" aria-hidden="true">
      <text x="12" y="10.5" textAnchor="middle" fontSize="12" fontWeight="700">
        Aa
      </text>
    </svg>
  );
}

interface Props {
  wasm?: ManifoldToplevel;
  segments: Segment[];
  symbolSize: number;
  onChange: (patch: { segments?: Segment[]; symbolSize?: number }) => void;
}

/** What goes on the label, left to right: any mix of text and symbols. */
export function SegmentEditor({ wasm, segments, symbolSize, onChange }: Props) {
  const setSegments = (next: Segment[]) => onChange({ segments: next });
  const replace = (i: number, seg: Segment) => setSegments(segments.map((s, j) => (j === i ? seg : s)));
  const move = (i: number, by: number) => {
    const next = [...segments];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    setSegments(next);
  };
  const hasSymbols = segments.some((s) => !isText(s));

  return (
    <section>
      <h2>Content</h2>
      <p className="hint">Text and symbols, left to right on the label. Add as many as you like.</p>
      <div className="symbol-palette">
        <button type="button" title="Add text" onClick={() => setSegments([...segments, { kind: "text", text: "" }])}>
          <TextIcon />
          <span>Text</span>
        </button>
        {SYMBOLS.map((info) => (
          <button
            key={info.kind}
            type="button"
            title={`Add ${info.name.toLowerCase()}`}
            disabled={!wasm}
            onClick={() => setSegments([...segments, { ...info.defaults }])}
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
                <label className="field">
                  <span>
                    Text <small>(one line per row)</small>
                  </span>
                  <textarea
                    rows={2}
                    spellCheck={false}
                    value={seg.text}
                    onChange={(e) => replace(i, { kind: "text", text: e.target.value })}
                  />
                </label>
              ) : (
                <SymbolOptions wasm={wasm} sym={seg} onChange={(p) => replace(i, { ...seg, ...p })} />
              )}
            </li>
          ))}
        </ol>
      )}

      {hasSymbols && (
        <label className="field">
          <span>
            Symbol height <output>{symbolSize.toFixed(1)} mm</output>
          </span>
          <input
            type="range"
            min={3}
            max={9.4}
            step={0.1}
            value={symbolSize}
            onChange={(e) => onChange({ symbolSize: Number(e.target.value) })}
          />
        </label>
      )}
    </section>
  );
}

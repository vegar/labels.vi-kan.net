import { useMemo } from "react";
import type { ManifoldToplevel } from "manifold-3d";
import type { SymbolPosition } from "../label";
import { DRIVES, renderSymbol, SYMBOLS, symbolInfo, toSvgPath, type Drive, type LabelSymbol } from "../symbols";
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

interface Props {
  wasm?: ManifoldToplevel;
  symbols: LabelSymbol[];
  position: SymbolPosition;
  size: number;
  onChange: (patch: { symbols?: LabelSymbol[]; symbolPosition?: SymbolPosition; symbolSize?: number }) => void;
}

export function SymbolEditor({ wasm, symbols, position, size, onChange }: Props) {
  const setSymbols = (next: LabelSymbol[]) => onChange({ symbols: next });
  const patch = (i: number, p: Partial<LabelSymbol>) => setSymbols(symbols.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, by: number) => {
    const next = [...symbols];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    setSymbols(next);
  };
  // One drive at a time, plus an optional security pin (like Torx TR).
  const toggleDrive = (i: number, drive: Drive) => {
    const drives = symbols[i].drives ?? [];
    const pin = drives.includes("security");
    let next: Drive[];
    if (drive === "security") next = pin ? drives.filter((d) => d !== "security") : [...drives, "security"];
    else next = [...(drives.includes(drive) ? [] : [drive]), ...(pin ? (["security"] as Drive[]) : [])];
    patch(i, { drives: next });
  };

  return (
    <section>
      <h2>Symbols</h2>
      <div className="symbol-palette">
        {SYMBOLS.map((info) => (
          <button
            key={info.kind}
            type="button"
            title={`Add ${info.name.toLowerCase()}`}
            disabled={!wasm}
            onClick={() => setSymbols([...symbols, { ...info.defaults }])}
          >
            {wasm && <SymbolIcon wasm={wasm} symbol={info.defaults} />}
            <span>{info.name}</span>
          </button>
        ))}
      </div>

      {symbols.length > 0 && (
        <>
          <ol className="symbol-list">
            {symbols.map((sym, i) => {
              const info = symbolInfo(sym.kind);
              return (
                <li key={i}>
                  <div className="symbol-head">
                    {wasm && <SymbolIcon wasm={wasm} symbol={sym} />}
                    <strong>{info.name}</strong>
                    <div className="symbol-actions">
                      <button type="button" title="Move left" disabled={i === 0} onClick={() => move(i, -1)}>
                        ←
                      </button>
                      <button
                        type="button"
                        title="Move right"
                        disabled={i === symbols.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => setSymbols(symbols.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {info.headShapes && (
                    <div className="chips" role="group" aria-label="Head">
                      {info.headShapes.map((h) => (
                        <button
                          key={h}
                          type="button"
                          aria-pressed={(sym.headShape ?? "pan") === h}
                          onClick={() => patch(i, { headShape: h })}
                        >
                          {HEAD_LABELS[h]}
                        </button>
                      ))}
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
                        onChange={(e) => patch(i, { length: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </label>
                  )}

                  {info.drives && (
                    <div className="chips" role="group" aria-label="Drive">
                      {DRIVES.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={sym.drives?.includes(d.value) ?? false}
                          onClick={() => toggleDrive(i, d.value)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {info.modifiers && (
                    <div className="row">
                      {info.modifiers.map((m) => (
                        <label key={m} className="check">
                          <input type="checkbox" checked={!!sym[m]} onChange={(e) => patch(i, { [m]: e.target.checked })} />
                          <span>{MODIFIER_LABELS[m]}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="row">
            <div className="field">
              <span>Position</span>
              <Segmented<SymbolPosition>
                value={position}
                options={[
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                ]}
                onChange={(symbolPosition) => onChange({ symbolPosition })}
              />
            </div>
          </div>
          <label className="field">
            <span>
              Symbol height <output>{size.toFixed(1)} mm</output>
            </span>
            <input
              type="range"
              min={3}
              max={9.4}
              step={0.1}
              value={size}
              onChange={(e) => onChange({ symbolSize: Number(e.target.value) })}
            />
          </label>
        </>
      )}
    </section>
  );
}

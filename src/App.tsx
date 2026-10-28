import { useEffect, useMemo, useState } from "react";
import { HEIGHT, widthForUnits } from "./cullenect";
import { to3mf, toStlZip, type ExportPart } from "./export";
import { maxEmbeddedDepth } from "./label";
import {
  addLabel,
  blankLabel,
  cloneLabel,
  fileName,
  loadSession,
  removeLabel,
  saveSession,
  updateLabel,
  type LabelState,
  type Session,
  type Weight,
} from "./state";
import { useEngine } from "./useEngine";
import { useLabels } from "./useLabels";
import { LabelList } from "./components/LabelList";
import { PreviewCanvas } from "./components/PreviewCanvas";
import type { PreviewLabel, RowLayout } from "./preview";
import { Segmented } from "./components/Segmented";
import { SymbolEditor } from "./components/SymbolEditor";

/** Below this letter height, text gets hard to read with a 0.4 mm nozzle. */
const MIN_LEGIBLE_CAP_HEIGHT = 4.4;

function download(data: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [session, setSession] = useState<Session>(loadSession);
  useEffect(() => saveSession(session), [session]);
  const state = session.labels.find((l) => l.id === session.selected) ?? session.labels[0];
  const update = (patch: Partial<LabelState>) => setSession((s) => updateLabel(s, state.id, patch));

  const { engine, error: engineError } = useEngine();
  const builds = useLabels(engine, session.labels);
  const { parts, error: buildError, ms } = builds.get(state.id) ?? {};

  // Prototype: how far the selected label stands out from the row in the preview.
  const [layout, setLayout] = useState<RowLayout>({ lift: 2, spread: 6 });
  const previewLabels = useMemo<PreviewLabel[]>(
    () =>
      session.labels.map((label) => {
        const built = builds.get(label.id)?.parts;
        return {
          id: label.id,
          width: widthForUnits(label.units),
          parts: built
            ? [
                { manifold: built.base, color: label.baseColor },
                ...(built.text ? [{ manifold: built.text, color: label.textColor }] : []),
                ...(built.symbols ? [{ manifold: built.symbols, color: label.symbolColor }] : []),
              ]
            : [],
        };
      }),
    [session.labels, builds],
  );

  // Flush text over the snap-fit channels can only go so deep.
  const maxDepth = state.style === "embedded" ? maxEmbeddedDepth(state) : 1;
  const textDepth = Math.min(state.textDepth, maxDepth);
  useEffect(() => {
    if (state.textDepth > maxDepth) update({ textDepth: maxDepth });
  }, [state.textDepth, maxDepth]);

  const shrunk = parts?.capHeight !== undefined && parts.capHeight < MIN_LEGIBLE_CAP_HEIGHT;
  const status = engineError
    ? `Could not load the label engine: ${engineError}`
    : buildError
      ? `Could not build this label: ${buildError}`
      : !parts
        ? "Loading…"
        : parts.capHeight
          ? `Letter height ${parts.capHeight.toFixed(1)} mm · built in ${ms} ms`
          : parts.symbols
            ? `Built in ${ms} ms`
            : "No text yet";

  const exportParts = (): ExportPart[] =>
    parts
      ? [
          { name: "label", manifold: parts.base, color: state.baseColor },
          ...(parts.text ? [{ name: "text", manifold: parts.text, color: state.textColor }] : []),
          ...(parts.symbols ? [{ name: "symbols", manifold: parts.symbols, color: state.symbolColor }] : []),
        ]
      : [];

  return (
    <main className="app">
      <aside className="panel">
        <header>
          <h1>Gridfinity Labels</h1>
          <p className="sub">Cullenect label, ready for multi-colour printing.</p>
        </header>

        <LabelList
          labels={session.labels}
          selected={state.id}
          onSelect={(id) => setSession((s) => ({ ...s, selected: id }))}
          onAdd={() => setSession((s) => addLabel(s, blankLabel(state)))}
          onClone={(id, texts) => setSession((s) => cloneLabel(s, id, texts))}
          onRemove={(id) => setSession((s) => removeLabel(s, id))}
        />

        <section>
          <h2>Label</h2>
          <div className="field">
            <span>Bin width</span>
            <Segmented
              value={state.units}
              options={[1, 2, 3].map((u) => ({ value: u, label: `${u}U` }))}
              onChange={(units) => update({ units })}
            />
          </div>
          <p className="hint">
            {widthForUnits(state.units)} × {HEIGHT} mm
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={state.ribs}
              disabled={state.units !== 1}
              onChange={(e) => update({ ribs: e.target.checked })}
            />
            <span>
              Snap-fit channels on the back <small>(1U only)</small>
            </span>
          </label>
        </section>

        <section>
          <h2>Text</h2>
          <label className="field">
            <span>
              Text <small>(one line per row)</small>
            </span>
            <textarea
              id="text"
              rows={2}
              spellCheck={false}
              value={state.text}
              onChange={(e) => update({ text: e.target.value })}
            />
          </label>
          <div className="row">
            <div className="field">
              <span>Align</span>
              <Segmented
                value={state.align}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ]}
                onChange={(align) => update({ align })}
              />
            </div>
            <div className="field">
              <span>Weight</span>
              <Segmented<Weight>
                value={state.weight}
                options={[
                  { value: "regular", label: "Regular" },
                  { value: "bold", label: "Bold" },
                ]}
                onChange={(weight) => update({ weight })}
              />
            </div>
          </div>
          <label className="field">
            <span>
              Max letter height <output>{state.maxCapHeight.toFixed(1)} mm</output>
            </span>
            <input
              type="range"
              min={2}
              max={9}
              step={0.1}
              value={state.maxCapHeight}
              onChange={(e) => update({ maxCapHeight: Number(e.target.value) })}
            />
          </label>
          {shrunk && (
            <p className="hint warn">
              Text was shrunk below {MIN_LEGIBLE_CAP_HEIGHT} mm to fit. That may be hard to read with a 0.4 mm
              nozzle; try fewer characters or a wider label.
            </p>
          )}
        </section>

        <SymbolEditor
          wasm={engine?.wasm}
          symbols={state.symbols}
          position={state.symbolPosition}
          size={state.symbolSize}
          onChange={update}
        />

        <section>
          <h2>Print style</h2>
          <Segmented
            value={state.style}
            options={[
              { value: "embedded", label: "Flush" },
              { value: "raised", label: "Raised" },
            ]}
            onChange={(style) => update({ style })}
          />
          <p className="hint">
            {state.style === "embedded"
              ? "Text is flush with the surface. Print face up and assign filaments to the text and symbol parts."
              : "Text stands proud of the surface. Works with a filament swap at the text layer, or as a second part."}
          </p>
          <label className="field">
            <span>
              Text depth <output>{textDepth.toFixed(1)} mm</output>
            </span>
            <input
              type="range"
              min={0.1}
              max={maxDepth}
              step={0.1}
              value={textDepth}
              onChange={(e) => update({ textDepth: Number(e.target.value) })}
            />
          </label>
          <div className="row colors">
            <label className="color">
              <input type="color" value={state.baseColor} onChange={(e) => update({ baseColor: e.target.value })} />
              <span>Label</span>
            </label>
            <label className="color">
              <input type="color" value={state.textColor} onChange={(e) => update({ textColor: e.target.value })} />
              <span>Text</span>
            </label>
            <label className="color">
              <input
                type="color"
                value={state.symbolColor}
                onChange={(e) => update({ symbolColor: e.target.value })}
              />
              <span>Symbols</span>
            </label>
          </div>
        </section>

        <section className="export">
          <button
            type="button"
            className="primary"
            disabled={!parts}
            onClick={() => download(to3mf(fileName(state), exportParts()), `${fileName(state)}.3mf`, "model/3mf")}
          >
            Download 3MF
          </button>
          <button
            type="button"
            disabled={!parts}
            onClick={() => download(toStlZip(exportParts()), `${fileName(state)}-stl.zip`, "application/zip")}
          >
            STL (zip)
          </button>
        </section>

        <footer>
          Label geometry from <a href="https://github.com/ndevenish/gflabel">gflabel</a> (BSD-3). Cullenect system by{" "}
          <a href="https://makerworld.com/en/models/446624">Cullen J Webb</a>.
        </footer>
      </aside>
      <section className="viewer">
        <PreviewCanvas labels={previewLabels} selected={state.id} layout={layout} />
        <div className="status">
          <div className="row-controls">
            <label>
              <span>
                Lift selected <output>{layout.lift.toFixed(1)} mm</output>
              </span>
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={layout.lift}
                onChange={(e) => setLayout((l) => ({ ...l, lift: Number(e.target.value) }))}
              />
            </label>
            <label>
              <span>
                Spread others <output>{layout.spread.toFixed(1)} mm</output>
              </span>
              <input
                type="range"
                min={0}
                max={40}
                step={0.5}
                value={layout.spread}
                onChange={(e) => setLayout((l) => ({ ...l, spread: Number(e.target.value) }))}
              />
            </label>
          </div>
          <div>{status}</div>
        </div>
      </section>
    </main>
  );
}

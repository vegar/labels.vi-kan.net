import { useEffect, useState } from "react";
import { HEIGHT, widthForUnits } from "./cullenect";
import { to3mf, toStlZip, type ExportPart } from "./export";
import { maxEmbeddedDepth } from "./label";
import { fileName, loadState, saveState, type LabelState, type Weight } from "./state";
import { useEngine } from "./useEngine";
import { useLabel } from "./useLabel";
import { PreviewCanvas } from "./components/PreviewCanvas";
import { Segmented } from "./components/Segmented";

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
  const [state, setState] = useState<LabelState>(loadState);
  const update = (patch: Partial<LabelState>) => setState((s) => ({ ...s, ...patch }));
  useEffect(() => saveState(state), [state]);

  const { engine, error: engineError } = useEngine();
  const { parts, error: buildError, ms } = useLabel(engine, state);

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
          : "No text yet";

  const exportParts = (): ExportPart[] =>
    parts
      ? [
          { name: "label", manifold: parts.base, color: state.baseColor },
          ...(parts.text ? [{ name: "text", manifold: parts.text, color: state.textColor }] : []),
        ]
      : [];

  return (
    <main className="app">
      <aside className="panel">
        <header>
          <h1>Gridfinity Labels</h1>
          <p className="sub">Cullenect label, ready for multi-colour printing.</p>
        </header>

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
              ? "Text is flush with the surface. Print face up and assign a second filament to the text part."
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
        <PreviewCanvas
          parts={parts}
          width={widthForUnits(state.units)}
          baseColor={state.baseColor}
          textColor={state.textColor}
        />
        <div className="status">{status}</div>
      </section>
    </main>
  );
}

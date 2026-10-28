import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BASE_KINDS, baseInfo, type BaseKind } from "./bases";
import { to3mf, toStlZip, type ExportObject } from "./export";
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
} from "./state";
import { useEngine } from "./useEngine";
import { useLabels } from "./useLabels";
import { LabelList } from "./components/LabelList";
import { PreviewCanvas } from "./components/PreviewCanvas";
import type { PreviewLabel, RowLayout } from "./preview";
import { Segmented } from "./components/Segmented";
import { SidebarResizer, useSidebarWidth } from "./components/SidebarResizer";
import { SegmentEditor } from "./components/SegmentEditor";
import { About } from "./components/About";

/** Below this letter height, text gets hard to read with a 0.4 mm nozzle. */
const MIN_LEGIBLE_CAP_HEIGHT = 4.4;

/** The URL hash, kept in sync so links like #about can switch pages. */
function useHash() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

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

  const [sidebarWidth, setSidebarWidth] = useSidebarWidth();
  // The about page covers the app instead of replacing it, so the preview keeps its camera.
  const showAbout = useHash() === "#about";

  const { engine, error: engineError } = useEngine();
  const builds = useLabels(engine, session.labels);
  const { parts, error: buildError, ms } = builds.get(state.id) ?? {};

  // Prototype: how far the selected label stands out from the others in the preview.
  const [layout, setLayout] = useState<RowLayout>({ lift: 7, spread: 4.5 });
  const previewLabels = useMemo<PreviewLabel[]>(
    () =>
      session.labels.map((label) => {
        const built = builds.get(label.id)?.parts;
        return {
          id: label.id,
          ...baseInfo(label.base).size(label.units),
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

  const base = baseInfo(state.base);
  const size = base.size(state.units);

  // Flush text over the snap-fit channels can only go so deep.
  const maxDepth = state.style === "embedded" ? maxEmbeddedDepth(state) : 1;
  const textDepth = Math.min(state.textDepth, maxDepth);
  useEffect(() => {
    if (state.textDepth > maxDepth) update({ textDepth: maxDepth });
  }, [state.textDepth, maxDepth]);

  // Only warn about text the layout made smaller; small text on purpose is fine.
  const shrunk = !!parts?.shrunk && parts.capHeight! < MIN_LEGIBLE_CAP_HEIGHT;
  const status = engineError
    ? `Could not load the label engine: ${engineError}`
    : buildError
      ? `Could not build this label: ${buildError}`
      : !parts
        ? "Loading…"
        : parts.capHeight
          ? `Smallest letters ${parts.capHeight.toFixed(1)} mm · built in ${ms} ms`
          : parts.symbols
            ? `Built in ${ms} ms`
            : "No text yet";

  // Every label goes into the export, so wait until all of them are built.
  const exportObjects = (): ExportObject[] =>
    session.labels.map((label) => {
      const built = builds.get(label.id)!.parts!;
      return {
        name: fileName(label),
        parts: [
          { name: "label", manifold: built.base, color: label.baseColor },
          ...(built.text ? [{ name: "text", manifold: built.text, color: label.textColor }] : []),
          ...(built.symbols ? [{ name: "symbols", manifold: built.symbols, color: label.symbolColor }] : []),
        ],
      };
    });
  const canExport = session.labels.every((label) => builds.get(label.id)?.parts);
  const count = session.labels.length;
  const exportName = count === 1 ? fileName(state) : `labels-${count}`;
  const labelCount = count === 1 ? "" : ` (${count} labels)`;

  return (
    <main className="app" style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <aside className="panel">
        <header>
          <h1>Gridfinity Labels</h1>
          <p className="sub">Cullenect and pred labels, ready for multi-colour printing.</p>
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
            <span>Label holder</span>
            <Segmented<BaseKind>
              value={state.base}
              options={BASE_KINDS.map((kind) => ({ value: kind, label: baseInfo(kind).name }))}
              // The legacy label only comes in one size, for 1U bins.
              onChange={(kind) => update(baseInfo(kind).oneSize ? { base: kind, units: 1 } : { base: kind })}
            />
          </div>
          {!base.oneSize && (
            <div className="field">
              <span>Bin width</span>
              <Segmented
                value={state.units}
                options={[1, 2, 3].map((u) => ({ value: u, label: `${u}U` }))}
                onChange={(units) => update({ units })}
              />
            </div>
          )}
          <p className="hint">
            {+size.width.toFixed(1)} × {size.height} mm{base.oneSize && ", for 1U bins"}
          </p>
          {state.base === "cullenect" && (
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
          )}
        </section>

        <SegmentEditor
          wasm={engine?.wasm}
          segments={state.segments}
          gap={state.gap}
          align={state.align}
          onChange={update}
        >
          {shrunk && (
            <p className="hint warn">
              Text was shrunk below {MIN_LEGIBLE_CAP_HEIGHT} mm to fit. That may be hard to read with a 0.4 mm
              nozzle; try fewer characters or a wider label.
            </p>
          )}
        </SegmentEditor>

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
            {state.style === "raised" && state.base === "pred" && " The face of a pred label sits 0.4 mm below a rim."}
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
            disabled={!canExport}
            onClick={() => download(to3mf(exportName, exportObjects()), `${exportName}.3mf`, "model/3mf")}
          >
            Download 3MF{labelCount}
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={() => download(toStlZip(exportObjects()), `${exportName}-stl.zip`, "application/zip")}
          >
            STL (zip)
          </button>
        </section>

        <footer>
          Label geometry from <a href="https://github.com/ndevenish/gflabel">gflabel</a> (BSD-3). Cullenect system by{" "}
          <a href="https://makerworld.com/en/models/446624">Cullen J Webb</a>, pred labels by{" "}
          <a href="https://www.printables.com/model/592545">pred</a>. <a href="#about">About</a>
        </footer>
      </aside>
      <SidebarResizer width={sidebarWidth} onChange={setSidebarWidth} />
      <section className="viewer">
        <PreviewCanvas
          labels={previewLabels}
          selected={state.id}
          layout={layout}
          onSelect={(id) => setSession((s) => ({ ...s, selected: id }))}
        />
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
      {showAbout && <About />}
    </main>
  );
}

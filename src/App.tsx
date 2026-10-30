import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { baseInfo } from "./bases";
import { to3mf, toStlZip, type ExportObject } from "./export";
import { maxEmbeddedDepth } from "./label";
import { fileName, loadSession, saveSession, updateLabel, type LabelState, type Session } from "./state";
import { useEngine } from "./useEngine";
import { useLabels } from "./useLabels";
import { MIN_LEGIBLE_CAP_HEIGHT } from "./components/labelOps";
import { PreviewCanvas } from "./components/PreviewCanvas";
import type { PreviewLabel, RowLayout } from "./preview";
import { SidebarResizer, useSidebarWidth } from "./components/SidebarResizer";
import { About } from "./components/About";
import { Sidebar } from "./sidebar/Sidebar";

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

  const exportButtons = (
    <>
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
    </>
  );

  return (
    <main className="app" style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <aside className="panel">
        <header>
          <h1>Gridfinity Labels</h1>
          <p className="sub">Cullenect and pred labels, ready for multi-colour printing.</p>
        </header>

        <Sidebar
          session={session}
          setSession={setSession}
          state={state}
          update={update}
          engine={engine}
          builds={builds}
          textDepth={textDepth}
          maxDepth={maxDepth}
          shrunk={shrunk}
          exportButtons={exportButtons}
        />

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

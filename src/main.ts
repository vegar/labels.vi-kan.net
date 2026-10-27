import "./style.css";
import opentype, { type Font } from "opentype.js";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import type { ManifoldToplevel } from "manifold-3d";
import { loadManifold } from "./manifold";
import { buildLabel, DEFAULT_OPTIONS, maxEmbeddedDepth, type LabelOptions, type LabelParts } from "./label";
import { widthForUnits, HEIGHT } from "./cullenect";
import { to3mf, toStlZip, type ExportPart } from "./export";
import { Preview } from "./preview";

type Weight = "regular" | "bold";

interface State extends LabelOptions {
  weight: Weight;
  baseColor: string;
  textColor: string;
}

const STORAGE_KEY = "gridfinity-labels:v1";
const DEFAULT_STATE: State = {
  ...DEFAULT_OPTIONS,
  weight: "bold",
  baseColor: "#1f2328",
  textColor: "#f4f4f0",
};

function loadState(): State {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
  } catch {
    // Storage can be unavailable (private windows, blocked site data).
  }
  return { ...DEFAULT_STATE };
}

function saveState(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not critical; the label just won't be remembered.
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function loadFont(file: string): Promise<Font> {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  return opentype.parse(await res.arrayBuffer());
}

function download(data: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileName(state: State): string {
  const slug = state.text
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "")
    .slice(0, 40);
  return `label-${slug || "blank"}-${state.units}u`;
}

/** Wire up a group of buttons that behave like radio buttons. */
function segmented<T extends string>(id: string, get: () => T, set: (v: T) => void) {
  const root = $(id);
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button")];
  const sync = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === get())));
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      set(b.dataset.value as T);
      sync();
    }),
  );
  sync();
  return sync;
}

async function main() {
  const status = $("status");
  let wasm: ManifoldToplevel;
  let fonts: Record<Weight, Font>;
  try {
    [wasm, fonts] = await Promise.all([
      loadManifold(wasmUrl),
      Promise.all([loadFont("OpenSans-Regular.ttf"), loadFont("OpenSans-Bold.ttf")]).then(([regular, bold]) => ({
        regular,
        bold,
      })),
    ]);
  } catch (err) {
    status.textContent = `Could not load the label engine: ${err}`;
    return;
  }

  const state = loadState();
  const preview = new Preview($("preview"));
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const syncBackground = () => preview.setBackground(darkQuery.matches ? "#17191c" : "#eef0f2");
  darkQuery.addEventListener("change", syncBackground);
  syncBackground();

  let parts: LabelParts | undefined;

  const rebuild = () => {
    saveState(state);
    const started = performance.now();
    let next: LabelParts;
    try {
      next = buildLabel(wasm, fonts[state.weight], state);
    } catch (err) {
      status.textContent = `Could not build this label: ${err}`;
      return;
    }
    parts?.base.delete();
    parts?.text?.delete();
    parts = next;

    preview.update(
      [
        { manifold: parts.base, color: state.baseColor },
        ...(parts.text ? [{ manifold: parts.text, color: state.textColor }] : []),
      ],
      widthForUnits(state.units),
    );

    const ms = Math.round(performance.now() - started);
    status.textContent = parts.capHeight
      ? `Letter height ${parts.capHeight.toFixed(1)} mm · built in ${ms} ms`
      : "No text yet";
    const small = parts.capHeight !== undefined && parts.capHeight < 4.4;
    $("cap-hint").textContent = small
      ? "Text was shrunk below 4.4 mm to fit. That may be hard to read with a 0.4 mm nozzle; try fewer characters or a wider label."
      : "";
    $("cap-hint").classList.toggle("warn", small);
  };

  let pending = 0;
  const schedule = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(rebuild);
  };

  // Label
  const syncRibs = () => {
    const ribs = $<HTMLInputElement>("ribs");
    ribs.checked = state.ribs;
    ribs.disabled = state.units !== 1;
    $("size-hint").textContent = `${widthForUnits(state.units)} × ${HEIGHT} mm`;
  };
  segmented(
    "units",
    () => String(state.units),
    (v) => {
      state.units = Number(v);
      syncRibs();
      syncStyle();
      schedule();
    },
  );
  $<HTMLInputElement>("ribs").addEventListener("change", (e) => {
    state.ribs = (e.target as HTMLInputElement).checked;
    syncStyle();
    schedule();
  });
  syncRibs();

  // Text
  const text = $<HTMLTextAreaElement>("text");
  text.value = state.text;
  text.addEventListener("input", () => {
    state.text = text.value;
    schedule();
  });
  segmented("align", () => state.align, (v) => ((state.align = v), schedule()));
  segmented<Weight>("weight", () => state.weight, (v) => ((state.weight = v), schedule()));

  const cap = $<HTMLInputElement>("cap");
  const syncCap = () => ($("cap-out").textContent = `${state.maxCapHeight.toFixed(1)} mm`);
  cap.value = String(state.maxCapHeight);
  cap.addEventListener("input", () => {
    state.maxCapHeight = Number(cap.value);
    syncCap();
    schedule();
  });
  syncCap();

  // Style
  const syncStyle = () => {
    $("style-hint").textContent =
      state.style === "embedded"
        ? "Text is flush with the surface. Print face up and assign a second filament to the text part."
        : "Text stands proud of the surface. Works with a filament swap at the text layer, or as a second part.";
    // Flush text over the snap-fit channels can only go so deep.
    const max = state.style === "embedded" ? maxEmbeddedDepth(state) : 1;
    depth.max = String(max);
    state.textDepth = Math.min(state.textDepth, max);
    depth.value = String(state.textDepth);
    $("depth-out").textContent = `${state.textDepth.toFixed(1)} mm`;
  };
  const depth = $<HTMLInputElement>("depth");
  segmented("style", () => state.style, (v) => ((state.style = v), syncStyle(), schedule()));
  depth.addEventListener("input", () => {
    state.textDepth = Number(depth.value);
    syncStyle();
    schedule();
  });
  syncStyle();

  for (const [id, key] of [
    ["base-color", "baseColor"],
    ["text-color", "textColor"],
  ] as const) {
    const input = $<HTMLInputElement>(id);
    input.value = state[key];
    input.addEventListener("input", () => {
      state[key] = input.value;
      schedule();
    });
  }

  // Export
  const exportParts = (): ExportPart[] => {
    if (!parts) return [];
    return [
      { name: "label", manifold: parts.base, color: state.baseColor },
      ...(parts.text ? [{ name: "text", manifold: parts.text, color: state.textColor }] : []),
    ];
  };
  $("dl-3mf").addEventListener("click", () => {
    const name = fileName(state);
    download(to3mf(name, exportParts()), `${name}.3mf`, "model/3mf");
  });
  $("dl-stl").addEventListener("click", () => {
    download(toStlZip(exportParts()), `${fileName(state)}-stl.zip`, "application/zip");
  });

  rebuild();
}

main();

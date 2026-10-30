import { BASE_KINDS, baseInfo, type BaseKind } from "../bases";
import type { LabelState } from "../state";
import { ALIGN_OPTIONS, MmSlider } from "./SegmentEditor";
import { Segmented } from "./Segmented";

/** Below this letter height, text gets hard to read with a 0.4 mm nozzle. */
export const MIN_LEGIBLE_CAP_HEIGHT = 4.4;

export type Update = (patch: Partial<LabelState>) => void;

interface FieldProps {
  state: LabelState;
  update: Update;
}

/** Picking a holder: the legacy label only comes in one size, for 1U bins. */
export function holderPatch(kind: BaseKind): Partial<LabelState> {
  return baseInfo(kind).oneSize ? { base: kind, units: 1 } : { base: kind };
}

/** Label holder, bin width and snap-fit channels. */
export function HolderFields({ state, update }: FieldProps) {
  const base = baseInfo(state.base);
  const size = base.size(state.units);
  return (
    <>
      <div className="field">
        <span>Label holder</span>
        <Segmented<BaseKind>
          value={state.base}
          options={BASE_KINDS.map((kind) => ({ value: kind, label: baseInfo(kind).name }))}
          onChange={(kind) => update(holderPatch(kind))}
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
    </>
  );
}

export function ShrunkWarning() {
  return (
    <p className="hint warn">
      Text was shrunk below {MIN_LEGIBLE_CAP_HEIGHT} mm to fit. That may be hard to read with a 0.4 mm nozzle; try fewer
      characters or a wider label.
    </p>
  );
}

/** Where a packed row sits, and the gap between segments; only shown when they matter. */
export function RowFields({ state, update }: FieldProps) {
  const growing = state.segments.some((s) => s.grow);
  return (
    <>
      {state.segments.length > 0 && !growing && (
        <div className="field">
          <span>Row position</span>
          <Segmented value={state.align} options={ALIGN_OPTIONS} onChange={(align) => update({ align })} />
        </div>
      )}
      {state.segments.length > 1 && (
        <MmSlider label="Gap between segments" min={0} max={5} value={state.gap} onChange={(gap) => update({ gap })} />
      )}
    </>
  );
}

export function printStyleHint(state: LabelState): string {
  return (
    (state.style === "embedded"
      ? "Text is flush with the surface. Print face up and assign filaments to the text and symbol parts."
      : "Text stands proud of the surface. Works with a filament swap at the text layer, or as a second part.") +
    (state.style === "raised" && state.base === "pred" ? " The face of a pred label sits 0.4 mm below a rim." : "")
  );
}

/** Flush or raised, how deep, and the three colours. */
export function PrintStyleFields({
  state,
  update,
  textDepth,
  maxDepth,
}: FieldProps & { textDepth: number; maxDepth: number }) {
  return (
    <>
      <Segmented
        value={state.style}
        options={[
          { value: "embedded", label: "Flush" },
          { value: "raised", label: "Raised" },
        ]}
        onChange={(style) => update({ style })}
      />
      <p className="hint">{printStyleHint(state)}</p>
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
      <ColorFields state={state} update={update} />
    </>
  );
}

export function ColorFields({ state, update }: FieldProps) {
  return (
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
        <input type="color" value={state.symbolColor} onChange={(e) => update({ symbolColor: e.target.value })} />
        <span>Symbols</span>
      </label>
    </div>
  );
}

import { HolderFields, PrintStyleFields, ShrunkWarning } from "../components/LabelFields";
import { LabelList } from "../components/LabelList";
import { SegmentEditor } from "../components/SegmentEditor";
import { addLabel, blankLabel, cloneLabel, removeLabel } from "../state";
import type { SidebarProps } from "./types";

/** The current layout: every section open, one after the other. */
export function ClassicSidebar({ session, setSession, state, update, engine, ...props }: SidebarProps) {
  return (
    <>
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
        <HolderFields state={state} update={update} />
      </section>

      <SegmentEditor
        wasm={engine?.wasm}
        segments={state.segments}
        gap={state.gap}
        align={state.align}
        onChange={update}
      >
        {props.shrunk && <ShrunkWarning />}
      </SegmentEditor>

      <section>
        <h2>Print style</h2>
        <PrintStyleFields state={state} update={update} textDepth={props.textDepth} maxDepth={props.maxDepth} />
      </section>

      <section className="export">{props.exportButtons}</section>
    </>
  );
}

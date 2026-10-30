import { useEffect, useMemo, useRef, useState } from "react";
import type { ManifoldToplevel } from "manifold-3d";
import { isText, type Segment } from "../label";
import { labelTitle, type LabelState } from "../state";
import { cellValue, cloneColumns, pasteCells, withCell, type CloneColumn } from "./cloneGrid";
import { SymbolIcon, TextIcon } from "./Icons";

interface Props {
  source: LabelState;
  wasm?: ManifoldToplevel;
  /** The original's segments, which can be edited too, and one entry per copy. */
  onClone: (original: Segment[], copies: Segment[][]) => void;
  onClose: () => void;
}

/**
 * Make many copies of a label at once, edited like a spreadsheet: one row
 * per copy, one column per text and per symbol choice. The first row is the
 * original, which can be edited along with its copies.
 */
export function CloneDialog({ source, wasm, onClone, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const columns = useMemo(() => cloneColumns(source.segments), [source.segments]);
  /** The original, then the copies. */
  const [rows, setRows] = useState<Segment[][]>([source.segments, source.segments]);
  const copies = rows.length - 1;
  /** The cell to focus after the next render, e.g. in a row just added. */
  const [focus, setFocus] = useState<[number, number]>();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    if (!focus) return;
    const cell = table.current?.querySelector<HTMLElement>(`[data-cell="${focus[0]}:${focus[1]}"]`);
    cell?.focus();
    if (cell instanceof HTMLInputElement) cell.select();
    setFocus(undefined);
  }, [focus]);

  const submit = () => {
    if (!copies) return;
    onClone(rows[0], rows.slice(1));
    onClose();
  };

  const setCell = (r: number, column: CloneColumn, value: string) =>
    setRows((rows) => rows.map((row, i) => (i === r ? withCell(row, column, value) : row)));

  /** Go to the same column in another row, adding a row below the last. */
  const moveTo = (r: number, c: number) => {
    if (r < 0) return;
    if (r >= rows.length) setRows((rows) => [...rows, rows[rows.length - 1]]);
    setFocus([r, c]);
  };

  const removeRow = (r: number) => setRows((rows) => rows.filter((_, i) => i !== r));

  const cellProps = (r: number, c: number) => ({
    "data-cell": `${r}:${c}`,
    "aria-label": `${columns[c].title}, ${r ? `copy ${r}` : "original"}`,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit();
      } else if (e.key === "Enter" || (e.key === "ArrowDown" && !(e.target instanceof HTMLSelectElement))) {
        e.preventDefault();
        moveTo(r + 1, c);
      } else if (e.key === "ArrowUp" && !(e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        moveTo(r - 1, c);
      }
    },
    onPaste: (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      // A single value pastes into the cell as usual.
      if (!/[\t\n]/.test(text.replace(/\r?\n$/, ""))) return;
      e.preventDefault();
      setRows((rows) => pasteCells(rows, columns, r, c, text));
    },
  });

  const icon = (seg: Segment) =>
    isText(seg) ? (
      <TextIcon />
    ) : (
      wasm && <SymbolIcon wasm={wasm} symbol={{ ...seg, view: seg.kind === "screw" ? "drive" : seg.view }} />
    );

  return (
    <dialog ref={dialog} className="clone-dialog" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2>Clone “{labelTitle(source)}”</h2>
        {columns.length ? (
          <div className="clone-grid-scroll">
            <table className="clone-grid" ref={table}>
              <thead>
                <tr>
                  <th aria-label="Row" />
                  {columns.map((col, c) => (
                    <th key={c} scope="col">
                      <span className="clone-col-title">
                        {icon(source.segments[col.segment])}
                        {col.title}
                      </span>
                    </th>
                  ))}
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr
                    key={r}
                    className={r ? undefined : "clone-original"}
                    title={r ? undefined : "The label being cloned"}
                  >
                    <th scope="row">{r || "Original"}</th>
                    {columns.map((col, c) => (
                      <td
                        key={c}
                        className={cellValue(row, col) !== cellValue(source.segments, col) ? "changed" : undefined}
                      >
                        {col.options ? (
                          <select
                            {...cellProps(r, c)}
                            value={cellValue(row, col)}
                            onChange={(e) => setCell(r, col, e.target.value)}
                          >
                            {col.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            {...cellProps(r, c)}
                            autoFocus={r === 1 && c === 0}
                            type={col.field === "length" ? "number" : "text"}
                            min={col.field === "length" ? 1 : undefined}
                            max={col.field === "length" ? 200 : undefined}
                            spellCheck={false}
                            value={cellValue(row, col)}
                            onChange={(e) => setCell(r, col, e.target.value)}
                          />
                        )}
                      </td>
                    ))}
                    <td>
                      {r > 0 && (
                        <button
                          type="button"
                          className="clone-remove"
                          title="Remove this copy"
                          aria-label={`Remove copy ${r}`}
                          disabled={copies === 1}
                          onClick={() => removeRow(r)}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">This label has nothing to change per copy, so each row is an exact copy.</p>
        )}
        <div className="clone-grid-tools">
          <button type="button" onClick={() => moveTo(rows.length, 0)}>
            + Add row
          </button>
          <span className="hint">
            Enter adds a row. Paste rows from a spreadsheet. Use | for a line break. Edits to the original row change
            the original label. Size, style and colours stay the same.
          </span>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!copies}>
            {copies > 1 ? `Add ${copies} labels` : "Add label"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

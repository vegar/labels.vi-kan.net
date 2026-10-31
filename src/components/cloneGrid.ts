import { isText, type Segment } from "../label";
import { DRIVES, symbolInfo, type Drive, type HeadShape, type NutType } from "../symbols";
import { HEAD_LABELS, NUT_TYPES } from "./segmentOps";

/**
 * The clone dialog as a spreadsheet: one row per copy, one column per thing
 * that usually differs between copies. Texts get a column each, symbols get
 * one for each of their main choices (head and drive, length, nut type).
 * Everything else is copied from the original.
 */
export type CloneField = "text" | "head" | "drive" | "length" | "nutType";

export interface CloneColumn {
  /** Index of the segment the column edits. */
  segment: number;
  field: CloneField;
  title: string;
  /** The choices, for a dropdown column. */
  options?: { value: string; label: string }[];
}

const DRIVE_OPTIONS = [
  { value: "none", label: "None" },
  ...DRIVES.filter((d) => d.value !== "security").map((d) => ({ value: d.value as string, label: d.label })),
];

/** The columns for a label's segments, left to right. */
export function cloneColumns(segments: Segment[]): CloneColumn[] {
  // Number segments only when there are several of the same kind.
  const counts = new Map<string, number>();
  for (const s of segments) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  const seen = new Map<string, number>();

  return segments.flatMap((seg, segment): CloneColumn[] => {
    const n = (seen.get(seg.kind) ?? 0) + 1;
    seen.set(seg.kind, n);
    const name =
      (isText(seg) ? "Text" : symbolInfo(seg.kind).name.replace(/ \(.*\)$/, "")) +
      (counts.get(seg.kind)! > 1 ? ` ${n}` : "");
    if (isText(seg)) return [{ segment, field: "text", title: name }];

    const info = symbolInfo(seg.kind);
    const columns: CloneColumn[] = [];
    const isScrew = seg.kind === "screw";
    if (info.headShapes && seg.view !== "drive") {
      const options = info.headShapes.map((h) => ({ value: h as string, label: HEAD_LABELS[h] }));
      columns.push({ segment, field: "head", title: `${name} head`, options });
    }
    if (info.drives && seg.view !== "side") {
      const options = isScrew ? [...DRIVE_OPTIONS, { value: "hexhead", label: "Hex head bolt" }] : DRIVE_OPTIONS;
      columns.push({ segment, field: "drive", title: `${name} drive`, options });
    }
    if (info.length) columns.push({ segment, field: "length", title: `${name} length` });
    if (seg.kind === "nut") {
      const options = NUT_TYPES.map((t) => ({ value: t.value as string, label: t.label }));
      columns.push({ segment, field: "nutType", title: `${name} type`, options });
    }
    return columns;
  });
}

/** A cell as text. Line breaks in a text show as "|". */
export function cellValue(segments: Segment[], column: CloneColumn): string {
  const seg = segments[column.segment];
  if (isText(seg)) return seg.text.replace(/\n/g, "|");
  switch (column.field) {
    case "head":
      return seg.headShape ?? "pan";
    case "drive":
      return seg.hexHead ? "hexhead" : (seg.drives?.find((d) => d !== "security") ?? "none");
    case "length":
      return String(seg.length ?? 10);
    case "nutType":
      return seg.nutType ?? "regular";
    default:
      return "";
  }
}

/**
 * The segments with one cell set to `value`. A dropdown cell takes an
 * option's value or name in any case, so text pasted from a spreadsheet
 * works; anything it doesn't recognise leaves the cell as it was.
 */
export function withCell(segments: Segment[], column: CloneColumn, value: string): Segment[] {
  const seg = segments[column.segment];
  let next: Segment = seg;
  if (isText(seg)) {
    next = { ...seg, text: value.replace(/\|/g, "\n") };
  } else if (column.field === "length") {
    const n = Number(value.replace(/mm$/i, "").trim().replace(",", "."));
    if (value.trim() && Number.isFinite(n)) next = { ...seg, length: Math.min(200, Math.max(1, n)) };
  } else {
    const wanted = value.trim().toLowerCase();
    const option = column.options?.find((o) => o.value.toLowerCase() === wanted || o.label.toLowerCase() === wanted);
    if (option) {
      if (column.field === "head") next = { ...seg, headShape: option.value as HeadShape };
      if (column.field === "nutType") next = { ...seg, nutType: option.value as NutType };
      if (column.field === "drive") {
        const pin = seg.drives?.includes("security") ? (["security"] as const) : [];
        next =
          option.value === "hexhead"
            ? { ...seg, hexHead: true, drives: [] }
            : { ...seg, hexHead: false, drives: [...(option.value === "none" ? [] : [option.value as Drive]), ...pin] };
      }
    }
  }
  return next === seg ? segments : segments.map((s, i) => (i === column.segment ? next : s));
}

/**
 * Spread tab-separated rows, as copied from a spreadsheet, over the grid
 * from cell (`row`, `col`) down and to the right. Rows are added as needed,
 * each starting as a copy of the last row; columns past the edge are dropped.
 */
export function pasteCells(
  rows: Segment[][],
  columns: CloneColumn[],
  row: number,
  col: number,
  text: string,
): Segment[][] {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const next = [...rows];
  lines.forEach((line, i) => {
    const r = row + i;
    while (next.length <= r) next.push(next[next.length - 1]);
    line.split("\t").forEach((value, j) => {
      const column = columns[col + j];
      if (column) next[r] = withCell(next[r], column, value);
    });
  });
  return next;
}

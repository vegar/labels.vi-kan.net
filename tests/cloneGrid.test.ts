import { describe, expect, it } from "vitest";
import { cellValue, cloneColumns, pasteCells, withCell } from "../src/components/cloneGrid";
import { symbolSegment, textSegment, type Segment } from "../src/label";

const screw = symbolSegment({ kind: "screw", headShape: "countersunk", drives: ["phillips", "security"] });
const bolt = symbolSegment({ kind: "bolt", headShape: "socket", length: 12 });
const nut = symbolSegment({ kind: "nut" });
const washer = symbolSegment({ kind: "washer" });
const row: Segment[] = [screw, textSegment("M3 × 12"), textSegment("DIN 7991")];
const titles = (segments: Segment[]) => cloneColumns(segments).map((c) => c.title);

describe("clone grid", () => {
  it("gives each text a column and symbols one per main choice", () => {
    expect(titles(row)).toEqual(["Screw head", "Screw drive", "Text 1", "Text 2"]);
    expect(titles([bolt, nut, washer, textSegment("M4")])).toEqual(["Bolt head", "Bolt length", "Nut type", "Text"]);
  });

  it("leaves out choices a screw's view doesn't draw", () => {
    expect(titles([{ ...screw, view: "drive" }])).toEqual(["Screw drive"]);
    expect(titles([{ ...screw, view: "side" }])).toEqual(["Screw head"]);
    expect(titles([{ ...screw, view: "side", style: "cullenect" }])).toEqual(["Screw head"]);
    expect(titles([{ ...screw, view: "both", style: "cullenect" }])).toEqual(["Screw head", "Screw drive"]);
  });

  it("reads and writes cells", () => {
    const [head, drive, text] = cloneColumns(row);
    expect([head, drive, text].map((c) => cellValue(row, c))).toEqual(["countersunk", "phillips", "M3 × 12"]);
    const next = withCell(withCell(withCell(row, head, "socket"), drive, "torx"), text, "M4|Long");
    expect(next[0]).toMatchObject({ headShape: "socket", drives: ["torx", "security"] });
    expect(next[1]).toMatchObject({ text: "M4\nLong" });
    expect(cellValue(next, text)).toBe("M4|Long");
    expect(row[0]).toBe(screw);
    expect(withCell(row, drive, "hexhead")[0]).toMatchObject({ hexHead: true, drives: [] });
  });

  it("matches pasted names in any case and ignores ones it doesn't know", () => {
    const [head, drive] = cloneColumns(row);
    expect(withCell(row, head, " Pan ")[0]).toMatchObject({ headShape: "pan" });
    expect(withCell(row, drive, "pozidriv")[0]).toMatchObject({ drives: ["pozidrive", "security"] });
    expect(withCell(row, drive, "spanner")).toBe(row);
    const [, length] = cloneColumns([bolt]);
    expect(withCell([bolt], length, "16 mm")[0]).toMatchObject({ length: 16 });
    expect(withCell([bolt], length, "long")).toEqual([bolt]);
  });

  it("spreads pasted rows over the grid, adding rows as needed", () => {
    const columns = cloneColumns(row);
    const rows = pasteCells([row], columns, 0, 2, "M3 × 16\tDIN 912\r\nM3 × 20\tISO 7380\textra\r\n");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => columns.slice(2).map((c) => cellValue(r, c)))).toEqual([
      ["M3 × 16", "DIN 912"],
      ["M3 × 20", "ISO 7380"],
    ]);
    expect(rows[1][0]).toBe(screw);
  });
});

import { describe, expect, it } from "vitest";
import {
  addLabel,
  blankLabel,
  DEFAULT_STATE,
  duplicateLabel,
  labelTitle,
  parseSession,
  removeLabel,
  updateLabel,
  type LabelState,
  type Session,
} from "../src/state";

const label = (id: string, patch: Partial<LabelState> = {}): LabelState => ({ ...DEFAULT_STATE, id, ...patch });
const session = (...ids: string[]): Session => ({ labels: ids.map((id) => label(id)), selected: ids[0] });

describe("parseSession", () => {
  it("starts with one default label", () => {
    const s = parseSession(null, null);
    expect(s.labels).toHaveLength(1);
    expect(s.selected).toBe(s.labels[0].id);
    expect(s.labels[0].text).toBe(DEFAULT_STATE.text);
  });

  it("migrates the single label saved by earlier versions", () => {
    const s = parseSession(null, JSON.stringify({ text: "M4", units: 2 }));
    expect(s.labels).toHaveLength(1);
    expect(s.labels[0]).toMatchObject({ text: "M4", units: 2, weight: "bold" });
    expect(s.labels[0].id).toBeTruthy();
  });

  it("restores saved labels and the selection", () => {
    const saved = JSON.stringify({ labels: [{ id: "a", text: "A" }, { id: "b", text: "B" }], selected: "b" });
    const s = parseSession(saved, JSON.stringify({ text: "old" }));
    expect(s.labels.map((l) => l.text)).toEqual(["A", "B"]);
    expect(s.selected).toBe("b");
  });

  it("selects the first label when the saved selection is gone", () => {
    const s = parseSession(JSON.stringify({ labels: [{ id: "a" }], selected: "zz" }), null);
    expect(s.selected).toBe("a");
  });

  it("survives corrupt storage", () => {
    expect(parseSession("{nope", null).labels).toHaveLength(1);
  });
});

describe("label list", () => {
  it("adds a blank label after the selected one, keeping its print settings", () => {
    const s = session("a", "b");
    s.labels[0] = label("a", { units: 3, style: "raised", baseColor: "#ff0000", text: "Keep me" });
    const next = addLabel(s, blankLabel(s.labels[0]));
    expect(next.labels.map((l) => l.id)).toEqual(["a", next.selected, "b"]);
    expect(next.labels[1]).toMatchObject({ units: 3, style: "raised", baseColor: "#ff0000", text: "", symbols: [] });
  });

  it("duplicates a label with a new id and selects the copy", () => {
    const s = updateLabel(session("a", "b"), "b", { text: "M5" });
    const next = duplicateLabel(s, "b");
    expect(next.labels).toHaveLength(3);
    expect(next.labels[2].text).toBe("M5");
    expect(next.labels[2].id).not.toBe("b");
    expect(next.selected).toBe(next.labels[2].id);
  });

  it("removes a label and selects its neighbour", () => {
    const s = { ...session("a", "b", "c"), selected: "b" };
    expect(removeLabel(s, "b")).toMatchObject({ selected: "c" });
    expect(removeLabel({ ...s, selected: "c" }, "c")).toMatchObject({ selected: "b" });
    expect(removeLabel(s, "a").selected).toBe("b");
  });

  it("keeps the last label", () => {
    const s = session("a");
    expect(removeLabel(s, "a")).toBe(s);
  });

  it("names labels by their text", () => {
    expect(labelTitle(label("a", { text: "M3\n12 mm" }))).toBe("M3 · 12 mm");
    expect(labelTitle(label("a", { text: " " }))).toBe("1 symbol");
    expect(labelTitle(label("a", { text: "", symbols: [] }))).toBe("Blank");
  });
});

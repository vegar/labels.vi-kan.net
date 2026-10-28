import { describe, expect, it } from "vitest";
import {
  addLabel,
  blankLabel,
  cloneLabel,
  DEFAULT_STATE,
  labelTitle,
  parseCloneTexts,
  parseSession,
  removeLabel,
  updateLabel,
  type LabelState,
  type Session,
} from "../src/state";
import type { Segment } from "../src/label";

const text = (t: string): Segment => ({ kind: "text", text: t });
const texts = (l: LabelState) => l.segments.filter((s) => s.kind === "text").map((s) => (s as { text: string }).text);
const label = (id: string, patch: Partial<LabelState> = {}): LabelState => ({ ...DEFAULT_STATE, id, ...patch });
const session = (...ids: string[]): Session => ({ labels: ids.map((id) => label(id)), selected: ids[0] });

describe("parseSession", () => {
  it("starts with one default label", () => {
    const s = parseSession(null, null);
    expect(s.labels).toHaveLength(1);
    expect(s.selected).toBe(s.labels[0].id);
    expect(s.labels[0].segments).toEqual(DEFAULT_STATE.segments);
  });

  it("migrates the single label saved by earlier versions", () => {
    const s = parseSession(null, JSON.stringify({ text: "M4", units: 2 }));
    expect(s.labels).toHaveLength(1);
    expect(s.labels[0]).toMatchObject({ units: 2, weight: "bold" });
    expect(texts(s.labels[0])).toEqual(["M4"]);
    expect(s.labels[0].id).toBeTruthy();
  });

  it("restores saved labels and the selection", () => {
    const saved = JSON.stringify({ labels: [{ id: "a", segments: [text("A")] }, { id: "b", segments: [text("B")] }], selected: "b" });
    const s = parseSession(saved, JSON.stringify({ text: "old" }));
    expect(s.labels.map(texts)).toEqual([["A"], ["B"]]);
    expect(s.selected).toBe("b");
  });

  it("turns a saved text with symbols beside it into segments in the same order", () => {
    const screw = { kind: "screw", drives: ["hex"] };
    const nut = { kind: "nut" };
    const saved = JSON.stringify({
      labels: [
        { id: "a", text: "M3", symbols: [screw, nut], symbolPosition: "left" },
        { id: "b", text: "M3", symbols: [screw], symbolPosition: "right" },
        { id: "c", text: "", symbols: [nut] },
        { id: "d", text: "M5", symbols: [] },
        { id: "e", text: "M6", symbols: [{ kind: "squareNut" }] },
      ],
      selected: "a",
    });
    const [a, b, c, d, e] = parseSession(saved, null).labels;
    // The text grows to fill the width, like it used to.
    const grown = (t: string) => ({ ...text(t), grow: true });
    expect(a.segments).toEqual([screw, nut, grown("M3")]);
    expect(b.segments).toEqual([grown("M3"), screw]);
    expect(c.segments).toEqual([nut]);
    expect(d.segments).toEqual([grown("M5")]);
    expect(e.segments).toEqual([{ kind: "nut", nutType: "square" }, grown("M6")]);
    expect(a).not.toHaveProperty("text");
    expect(a).not.toHaveProperty("symbols");
    expect(a).not.toHaveProperty("symbolPosition");
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
    s.labels[0] = label("a", { units: 3, style: "raised", baseColor: "#ff0000", segments: [text("Keep me")] });
    const next = addLabel(s, blankLabel(s.labels[0]));
    expect(next.labels.map((l) => l.id)).toEqual(["a", next.selected, "b"]);
    expect(next.labels[1]).toMatchObject({ units: 3, style: "raised", baseColor: "#ff0000", segments: [text("")] });
  });

  it("clones a label once per text, replacing only its first text", () => {
    const nut: Segment = { kind: "nut" };
    const segments = [nut, text("M3 × 12"), text("DIN 912")];
    const s = updateLabel(session("a", "b"), "a", { units: 3, style: "raised", baseColor: "#ff0000", segments });
    const next = cloneLabel(s, "a", ["M3 × 16", "M3 × 20"]);
    expect(next.labels.map(texts)).toEqual([
      ["M3 × 12", "DIN 912"],
      ["M3 × 16", "DIN 912"],
      ["M3 × 20", "DIN 912"],
      texts(label("b")),
    ]);
    expect(next.labels[1].segments[0]).toEqual(nut);
    expect(next.labels[2]).toMatchObject({ units: 3, style: "raised", baseColor: "#ff0000" });
    expect(new Set(next.labels.map((l) => l.id)).size).toBe(4);
    expect(next.selected).toBe(next.labels[1].id);
    expect(cloneLabel(s, "a", [])).toBe(s);
  });

  it("adds the text to a clone of a label with symbols only", () => {
    const nut: Segment = { kind: "nut" };
    const s = updateLabel(session("a"), "a", { segments: [nut] });
    expect(cloneLabel(s, "a", ["M4"]).labels[1].segments).toEqual([nut, text("M4")]);
  });

  it("reads one label per line, with | for a line break", () => {
    expect(parseCloneTexts("M3 × 16\n\n  M4 | Socket head \n")).toEqual(["M3 × 16", "M4\nSocket head"]);
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
    expect(labelTitle(label("a", { segments: [text("M3\n12 mm")] }))).toBe("M3 · 12 mm");
    expect(labelTitle(label("a", { segments: [text("M3"), { kind: "nut" }, text("DIN 934")] }))).toBe("M3 DIN 934");
    expect(labelTitle(label("a", { segments: [{ kind: "nut" }, text(" ")] }))).toBe("Nut");
    expect(labelTitle(label("a", { segments: [{ kind: "nut" }, { kind: "washer" }] }))).toBe("2 symbols");
    expect(labelTitle(label("a", { segments: [] }))).toBe("Blank");
  });
});

import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import opentype from "opentype.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Manifold, ManifoldToplevel } from "manifold-3d";
import { buildByKind } from "./parts";
import { loadManifold } from "../src/manifold";
import { DEFAULT_OPTIONS, maxEmbeddedDepth, textSegment } from "../src/label";
import { plateLayout, to3mf, toStl, toStlZip } from "../src/export";

let wasm: ManifoldToplevel;
const fontData = readFileSync(new URL("../public/fonts/OpenSans-Regular.ttf", import.meta.url));
const font = opentype.parse(fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength));
const fonts = { regular: font, bold: font };

beforeAll(async () => {
  wasm = await loadManifold();
});

describe("buildLabel", () => {
  it("builds a 1U cullenect body of the right size", () => {
    const { base } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, segments: [] });
    const box = base.boundingBox();
    expect(box.max[0] - box.min[0]).toBeCloseTo(36, 3);
    expect(box.max[1] - box.min[1]).toBeCloseTo(11, 3);
    expect(box.min[2]).toBeCloseTo(-1.2, 3);
    expect(box.max[2]).toBeCloseTo(0, 3);
    expect(base.status()).toBe("NoError");
  });

  it("scales width with units", () => {
    const { base } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, units: 3, segments: [] });
    const box = base.boundingBox();
    expect(box.max[0] - box.min[0]).toBeCloseTo(120, 3);
  });

  it("embeds text flush with the face and keeps the total volume", () => {
    const empty = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, segments: [] });
    const { base, text } = buildByKind(wasm, fonts, DEFAULT_OPTIONS);
    expect(text).toBeDefined();
    const tb = text!.boundingBox();
    expect(tb.max[2]).toBeCloseTo(0, 3);
    expect(tb.min[2]).toBeCloseTo(-0.2, 3);
    expect(base.volume() + text!.volume()).toBeCloseTo(empty.base.volume(), 2);
  });

  it("keeps text inside the margins and under the max cap height", () => {
    const { text, capHeight } = buildByKind(wasm, fonts, {
      ...DEFAULT_OPTIONS,
      segments: [textSegment("A very long label that must shrink")],
    });
    const tb = text!.boundingBox();
    expect(tb.min[0]).toBeGreaterThanOrEqual(-18 + 0.8 - 1e-3);
    expect(tb.max[0]).toBeLessThanOrEqual(18 - 0.8 + 1e-3);
    expect(capHeight!).toBeLessThan(6);
  });

  it("leaves material above the snap-fit channels for deep flush text", () => {
    const { text } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, textDepth: 0.6 });
    expect(text!.boundingBox().min[2]).toBeCloseTo(-0.3, 3);
    const noRibs = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, ribs: false, textDepth: 0.6 });
    expect(noRibs.text!.boundingBox().min[2]).toBeCloseTo(-0.6, 3);
  });

  it("raises text above the face", () => {
    const { text } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, style: "raised" });
    const tb = text!.boundingBox();
    expect(tb.min[2]).toBeCloseTo(0, 3);
    expect(tb.max[2]).toBeCloseTo(0.2, 3);
  });
});

describe("label holders", () => {
  const blank = { ...DEFAULT_OPTIONS, segments: [] };
  const size = (m: Manifold) => {
    const { min, max } = m.boundingBox();
    return [max[0] - min[0], max[1] - min[1], min[2], max[2]];
  };

  it("builds a Cullenect legacy body with three channels, whatever the width", () => {
    const { base } = buildByKind(wasm, fonts, { ...blank, base: "cullenect-legacy", units: 3 });
    const [w, h, bottom, top] = size(base);
    expect(base.status()).toBe("NoError");
    expect(w).toBeCloseTo(36.4, 3);
    expect(h).toBeCloseTo(11, 3);
    expect(bottom).toBeCloseTo(-1, 3);
    expect(top).toBeCloseTo(0, 3);
    // The plate less three channels of 0.9 × 0.2 + 2 × 0.4 mm² each, the length of the label.
    const plate = wasm.CrossSection.square([36.4, 11], true).offset(0, "Round").area();
    expect(base.volume()).toBeLessThan(plate - 3 * 0.9 * 11);
    expect(base.volume()).toBeGreaterThan(plate - 3 * 1.1 * 11 - 1);
  });

  it("fits Gridfinity Extended's Cullenect legacy pocket", () => {
    // 36.7 × 11.3 mm plus 0.3 mm padding.
    const { base } = buildByKind(wasm, fonts, { ...blank, base: "cullenect-legacy" });
    const [w, h] = size(base);
    expect(w).toBeLessThan(37);
    expect(h).toBeLessThan(11.6);
  });

  it("builds a flat pred body with tabs, 42 mm a unit less 4.2", () => {
    for (const units of [1, 2, 3]) {
      const { base } = buildByKind(wasm, fonts, { ...blank, base: "pred", units });
      const [w, h, bottom, top] = size(base);
      expect(base.status()).toBe("NoError");
      expect(w).toBeCloseTo(units * 42 - 4.2, 3);
      expect(h).toBeCloseTo(11, 3);
      expect(bottom).toBeCloseTo(-0.8, 3);
      expect(top).toBeCloseTo(0, 3);
      // Gridfinity Extended's pred pocket: 42u - 5.8 by 11.35 mm, with 1 × 6.7 mm tabs at the ends.
      const ends = base.trimByPlane([1, 0, 0], (units * 42 - 5.8) / 2);
      expect(size(ends)[1]).toBeLessThan(6.7);
    }
  });

  it("sinks a pred label's face below a rim for raised text", () => {
    const { base, text } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, base: "pred", style: "raised" });
    const [, , bottom, top] = size(base);
    expect(bottom).toBeCloseTo(-0.4, 3);
    expect(top).toBeCloseTo(0.4, 3);
    expect(text!.boundingBox().min[2]).toBeCloseTo(0, 3);
    // The face, at z = 0, is the top of the body in the middle.
    const middle = base.trimByPlane([0, 0, 1], -0.1).intersect(wasm.Manifold.cube([4, 4, 2], true));
    expect(middle.boundingBox().max[2]).toBeCloseTo(0, 3);
  });

  it("keeps text clear of a pred label's holes", () => {
    const { text } = buildByKind(wasm, fonts, {
      ...DEFAULT_OPTIONS,
      base: "pred",
      segments: [textSegment("A very long label that must shrink")],
    });
    const tb = text!.boundingBox();
    expect(tb.min[0]).toBeGreaterThanOrEqual(-(37.8 - 5.5) / 2);
    expect(tb.max[0]).toBeLessThanOrEqual((37.8 - 5.5) / 2);
  });

  it("limits flush text to leave material at the back", () => {
    expect(maxEmbeddedDepth({ base: "cullenect-legacy", units: 1, ribs: false })).toBeCloseTo(0.3);
    expect(maxEmbeddedDepth({ base: "pred", units: 1, ribs: true })).toBeCloseTo(0.6);
    const { text } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, base: "pred", textDepth: 1 });
    expect(text!.boundingBox().min[2]).toBeCloseTo(-0.6, 3);
  });
});

describe("export", () => {
  it("writes a 3MF with one object per part plus an assembly", () => {
    const { base, text } = buildByKind(wasm, fonts, DEFAULT_OPTIONS);
    const files = unzipSync(
      to3mf("test", [
        {
          name: "label",
          parts: [
            { name: "base", manifold: base, color: "#202020" },
            { name: "text", manifold: text!, color: "#ffffff" },
          ],
        },
      ]),
    );
    const model = strFromU8(files["3D/3dmodel.model"]);
    expect(model.match(/<object /g)).toHaveLength(3);
    expect(model.match(/<item /g)).toHaveLength(1);
    expect(model).toContain('displaycolor="#FFFFFFFF"');
    expect(files["[Content_Types].xml"]).toBeDefined();
  });

  it("puts every label in the 3MF as its own object", () => {
    const a = buildByKind(wasm, fonts, DEFAULT_OPTIONS);
    const b = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, segments: [textSegment("M4")], units: 2 });
    const files = unzipSync(
      to3mf("test", [
        {
          name: "a",
          parts: [
            { name: "label", manifold: a.base, color: "#202020" },
            { name: "text", manifold: a.text!, color: "#ffffff" },
          ],
        },
        {
          name: "b",
          parts: [
            { name: "label", manifold: b.base, color: "#202020" },
            { name: "text", manifold: b.text!, color: "#ff0000" },
          ],
        },
      ]),
    );
    const model = strFromU8(files["3D/3dmodel.model"]);
    // Parts 2, 3 and assembly 4; parts 5, 6 and assembly 7.
    expect([...model.matchAll(/<item objectid="(\d+)"/g)].map((m) => m[1])).toEqual(["4", "7"]);
    expect(model).toContain('<object id="7" name="b" type="model"><components><component objectid="5"/><component objectid="6"/>');
    expect(model).toContain('pid="1" pindex="3"');

    // Filament slots are shared across labels: same colour, same slot.
    const settings = strFromU8(files["Metadata/model_settings.config"]);
    expect([...settings.matchAll(/<object id="(\d+)">/g)].map((m) => m[1])).toEqual(["4", "7"]);
    const parts = [...settings.matchAll(/<part id="(\d+)"[\s\S]*?key="extruder" value="(\d+)"/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(parts).toEqual([
      ["2", "1"],
      ["3", "2"],
      ["5", "1"],
      ["6", "3"],
    ]);
  });

  it("lays labels out back to front without overlapping", () => {
    const labels = Array.from({ length: 20 }, (_, i) => {
      const { base } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, segments: [], units: (i % 3) + 1 });
      return { name: `l${i}`, parts: [{ name: "label", manifold: base, color: "#202020" }] };
    });
    const layout = plateLayout(labels);
    const boxes = labels.map((l, i) => {
      const b = l.parts[0].manifold.boundingBox();
      const [x, y, z] = layout[i];
      expect(b.min[2] + z).toBeCloseTo(0, 6);
      return { minX: b.min[0] + x, maxX: b.max[0] + x, minY: b.min[1] + y, maxY: b.max[1] + y };
    });
    // The first label is at the back (highest y) of the first column.
    expect(boxes[1].maxY).toBeLessThan(boxes[0].minY);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [p, q] = [boxes[i], boxes[j]];
        const overlap = p.minX < q.maxX && q.minX < p.maxX && p.minY < q.maxY && q.minY < p.maxY;
        expect(overlap).toBe(false);
      }
      // Everything stays on a 256 mm plate.
      expect(boxes[i].minX).toBeGreaterThan(0);
      expect(boxes[i].maxX).toBeLessThan(256);
      expect(boxes[i].minY).toBeGreaterThan(0);
      expect(boxes[i].maxY).toBeLessThan(256);
    }
  });

  it("zips STLs in a folder per label, numbering repeated names", () => {
    const { base } = buildByKind(wasm, fonts, { ...DEFAULT_OPTIONS, segments: [] });
    const object = { name: "label-M3", parts: [{ name: "label", manifold: base, color: "#202020" }] };
    const files = unzipSync(toStlZip([object, object]));
    expect(Object.keys(files).sort()).toEqual(["label-M3-2/label.stl", "label-M3/label.stl"]);
  });

  it("writes a binary STL with the right triangle count", () => {
    const { base } = buildByKind(wasm, fonts, DEFAULT_OPTIONS);
    const stl = toStl(base);
    const count = new DataView(stl.buffer).getUint32(80, true);
    expect(count).toBe(base.numTri());
    expect(stl.length).toBe(84 + count * 50);
  });
});

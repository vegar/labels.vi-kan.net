import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import opentype from "opentype.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { loadManifold } from "../src/manifold";
import { buildLabel, DEFAULT_OPTIONS } from "../src/label";
import { to3mf, toStl } from "../src/export";

let wasm: ManifoldToplevel;
const fontData = readFileSync(new URL("../public/fonts/OpenSans-Regular.ttf", import.meta.url));
const font = opentype.parse(fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength));

beforeAll(async () => {
  wasm = await loadManifold();
});

describe("buildLabel", () => {
  it("builds a 1U cullenect body of the right size", () => {
    const { base } = buildLabel(wasm, font, { ...DEFAULT_OPTIONS, text: "" });
    const box = base.boundingBox();
    expect(box.max[0] - box.min[0]).toBeCloseTo(36, 3);
    expect(box.max[1] - box.min[1]).toBeCloseTo(11, 3);
    expect(box.min[2]).toBeCloseTo(-1.2, 3);
    expect(box.max[2]).toBeCloseTo(0, 3);
    expect(base.status()).toBe("NoError");
  });

  it("scales width with units", () => {
    const { base } = buildLabel(wasm, font, { ...DEFAULT_OPTIONS, units: 3, text: "" });
    const box = base.boundingBox();
    expect(box.max[0] - box.min[0]).toBeCloseTo(120, 3);
  });

  it("embeds text flush with the face and keeps the total volume", () => {
    const empty = buildLabel(wasm, font, { ...DEFAULT_OPTIONS, text: "" });
    const { base, text } = buildLabel(wasm, font, DEFAULT_OPTIONS);
    expect(text).toBeDefined();
    const tb = text!.boundingBox();
    expect(tb.max[2]).toBeCloseTo(0, 3);
    expect(tb.min[2]).toBeCloseTo(-0.2, 3);
    expect(base.volume() + text!.volume()).toBeCloseTo(empty.base.volume(), 2);
  });

  it("keeps text inside the margins and under the max cap height", () => {
    const { text, capHeight } = buildLabel(wasm, font, {
      ...DEFAULT_OPTIONS,
      text: "A very long label that must shrink",
    });
    const tb = text!.boundingBox();
    expect(tb.min[0]).toBeGreaterThanOrEqual(-18 + 0.8 - 1e-3);
    expect(tb.max[0]).toBeLessThanOrEqual(18 - 0.8 + 1e-3);
    expect(capHeight!).toBeLessThan(6);
  });

  it("leaves material above the snap-fit channels for deep flush text", () => {
    const { text } = buildLabel(wasm, font, { ...DEFAULT_OPTIONS, textDepth: 0.6 });
    expect(text!.boundingBox().min[2]).toBeCloseTo(-0.3, 3);
    const noRibs = buildLabel(wasm, font, { ...DEFAULT_OPTIONS, ribs: false, textDepth: 0.6 });
    expect(noRibs.text!.boundingBox().min[2]).toBeCloseTo(-0.6, 3);
  });

  it("raises text above the face", () => {
    const { text } = buildLabel(wasm, font, { ...DEFAULT_OPTIONS, style: "raised" });
    const tb = text!.boundingBox();
    expect(tb.min[2]).toBeCloseTo(0, 3);
    expect(tb.max[2]).toBeCloseTo(0.2, 3);
  });
});

describe("export", () => {
  it("writes a 3MF with one object per part plus an assembly", () => {
    const { base, text } = buildLabel(wasm, font, DEFAULT_OPTIONS);
    const files = unzipSync(
      to3mf("test", [
        { name: "base", manifold: base, color: "#202020" },
        { name: "text", manifold: text!, color: "#ffffff" },
      ]),
    );
    const model = strFromU8(files["3D/3dmodel.model"]);
    expect(model.match(/<object /g)).toHaveLength(3);
    expect(model).toContain('displaycolor="#FFFFFFFF"');
    expect(files["[Content_Types].xml"]).toBeDefined();
  });

  it("writes a binary STL with the right triangle count", () => {
    const { base } = buildLabel(wasm, font, DEFAULT_OPTIONS);
    const stl = toStl(base);
    const count = new DataView(stl.buffer).getUint32(80, true);
    expect(count).toBe(base.numTri());
    expect(stl.length).toBe(84 + count * 50);
  });
});

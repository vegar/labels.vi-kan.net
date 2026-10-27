import { readFileSync } from "node:fs";
import opentype from "opentype.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { loadManifold } from "../src/manifold";
import { buildLabel, DEFAULT_OPTIONS } from "../src/label";
import { DRIVES, renderSymbol, SYMBOLS, type LabelSymbol } from "../src/symbols";

let wasm: ManifoldToplevel;
const fontData = readFileSync(new URL("../public/fonts/OpenSans-Regular.ttf", import.meta.url));
const font = opentype.parse(fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength));

beforeAll(async () => {
  wasm = await loadManifold();
});

/** Every symbol with every option that applies to it. */
function variants(): LabelSymbol[] {
  const out: LabelSymbol[] = [];
  for (const info of SYMBOLS) {
    out.push(info.defaults);
    for (const headShape of info.headShapes ?? []) out.push({ ...info.defaults, headShape });
    for (const m of info.modifiers ?? []) out.push({ ...info.defaults, [m]: true });
    if (info.drives) for (const d of DRIVES) out.push({ ...info.defaults, drives: [d.value] });
  }
  return out;
}

describe("renderSymbol", () => {
  it.each(variants().map((v) => [JSON.stringify(v), v] as const))("draws %s", (_, sym) => {
    const shape = renderSymbol(wasm, sym, 8, 30);
    expect(shape.isEmpty()).toBe(false);
    const { min, max } = shape.bounds();
    // Only the Cullenect bolt is drawn taller than the row.
    const limit = sym.kind === "cullbolt" ? 8 * 1.6 : 8;
    expect(max[1] - min[1]).toBeLessThanOrEqual(limit * 1.01);
    expect(max[1] - min[1]).toBeGreaterThan(2);
  });

  it("cuts a drive recess into a head", () => {
    const plain = renderSymbol(wasm, { kind: "head" }, 8).area();
    const torx = renderSymbol(wasm, { kind: "head", drives: ["torx"] }, 8).area();
    const secure = renderSymbol(wasm, { kind: "head", drives: ["torx", "security"] }, 8).area();
    expect(torx).toBeLessThan(plain);
    expect(secure).toBeGreaterThan(torx);
  });

  it("draws a screw as a head view beside a separate side view", () => {
    const shape = renderSymbol(wasm, { kind: "screw", headShape: "countersunk", drives: ["phillips"] }, 8);
    const pieces = shape.decompose().map((p) => p.bounds());
    const head = pieces.filter((b) => b.max[0] <= 0);
    const side = pieces.filter((b) => b.min[0] >= 0);
    expect(head.length + side.length).toBe(pieces.length);
    expect(head.length).toBeGreaterThan(0);
    expect(side).toHaveLength(1);
    expect(side[0].max[0] - side[0].min[0]).toBeCloseTo(8 * 1.6, 3);
  });

  it("draws a bolt to length, and breaks it when it is too long", () => {
    const short = renderSymbol(wasm, { kind: "bolt", headShape: "socket", length: 12 }, 8, 40).bounds();
    expect(short.max[0] - short.min[0]).toBeCloseTo(12 + 8 / 2.25, 3);
    const long = renderSymbol(wasm, { kind: "bolt", headShape: "socket", length: 60 }, 8, 20);
    expect(long.bounds().max[0] - long.bounds().min[0]).toBeCloseTo(20, 3);
    expect(long.decompose()).toHaveLength(2);
  });
});

describe("labels with symbols", () => {
  const withBolt = { ...DEFAULT_OPTIONS, symbols: [{ kind: "cullbolt", headShape: "socket", drives: ["hex"] }] as LabelSymbol[] };

  it("puts symbols and text side by side inside the margins", () => {
    for (const symbolPosition of ["left", "right"] as const) {
      const { text, symbols } = buildLabel(wasm, font, { ...withBolt, symbolPosition });
      const tb = text!.boundingBox();
      const sb = symbols!.boundingBox();
      for (const b of [tb, sb]) {
        expect(b.min[0]).toBeGreaterThanOrEqual(-18 + 0.8 - 1e-3);
        expect(b.max[0]).toBeLessThanOrEqual(18 - 0.8 + 1e-3);
        expect(b.min[1]).toBeGreaterThanOrEqual(-5.5 + 0.8 - 1e-3);
        expect(b.max[1]).toBeLessThanOrEqual(5.5 - 0.8 + 1e-3);
      }
      if (symbolPosition === "left") expect(sb.max[0]).toBeLessThan(tb.min[0]);
      else expect(tb.max[0]).toBeLessThan(sb.min[0]);
    }
  });

  it("inlays symbols flush and keeps the total volume", () => {
    const empty = buildLabel(wasm, font, { ...DEFAULT_OPTIONS, text: "" });
    const { base, text, symbols } = buildLabel(wasm, font, withBolt);
    const sb = symbols!.boundingBox();
    expect(sb.max[2]).toBeCloseTo(0, 3);
    expect(sb.min[2]).toBeCloseTo(-0.2, 3);
    expect(base.volume() + text!.volume() + symbols!.volume()).toBeCloseTo(empty.base.volume(), 2);
  });

  it("centers symbols when there is no text", () => {
    const { text, symbols } = buildLabel(wasm, font, { ...withBolt, text: "" });
    expect(text).toBeUndefined();
    const sb = symbols!.boundingBox();
    expect(sb.min[0] + sb.max[0]).toBeCloseTo(0, 3);
  });

  it("gives a bolt the room the text leaves", () => {
    const opts = { ...DEFAULT_OPTIONS, units: 3, text: "M4", symbols: [{ kind: "bolt", length: 40 }] as LabelSymbol[] };
    const sb = buildLabel(wasm, font, opts).symbols!.boundingBox();
    expect(sb.max[0] - sb.min[0]).toBeGreaterThan(40);
  });
});

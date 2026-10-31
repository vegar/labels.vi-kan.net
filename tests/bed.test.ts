import { describe, expect, it } from "vitest";
import { bedOf, packPlates, plateColumns, plateCount, plateOrigin, tooLarge } from "../src/bed";

const bed = { width: 100, depth: 60 };
const item = (width: number, depth = 10) => ({ width, depth });

describe("packPlates", () => {
  it("centres a single item on the plate", () => {
    expect(packPlates([item(40)], bed)).toEqual([{ plate: 0, x: 50, y: 30 }]);
  });

  it("fills a row left to right, then the next row towards the front, then the next plate", () => {
    // 90 × 50 mm usable: two 40 mm items per row, three 10 mm rows with 5 mm gaps.
    const placed = packPlates(
      Array.from({ length: 7 }, () => item(40)),
      bed,
    );
    expect(placed.map((p) => p.plate)).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(placed[1].x).toBeGreaterThan(placed[0].x);
    expect(placed[1].y).toBe(placed[0].y);
    expect(placed[2].y).toBeLessThan(placed[0].y);
    expect(placed[2].x).toBe(placed[0].x);
    // The plate's layout is centred: a row of two 40 mm items 5 mm apart is 85 mm wide.
    expect(placed[0].x).toBeCloseTo(7.5 + 20);
    expect(placed[1].x).toBeCloseTo(7.5 + 65);
    expect(plateCount(placed)).toBe(2);
  });

  it("fills the gap at the end of an earlier row with a later, shorter item", () => {
    const placed = packPlates([item(60), item(60), item(20)], bed);
    expect(placed[1].y).toBeLessThan(placed[0].y);
    expect(placed[2].y).toBe(placed[0].y);
    expect(placed[2].x).toBeGreaterThan(placed[0].x);
  });

  it("gives an item too large for the plate a plate of its own", () => {
    const placed = packPlates([item(20), item(200), item(20)], bed);
    expect(placed.map((p) => p.plate)).toEqual([0, 1, 2]);
    expect(tooLarge(item(200), bed)).toBe(true);
    expect(tooLarge(item(90, 50), bed)).toBe(false);
  });
});

describe("keep-clear zones", () => {
  const overlaps = (
    p: { x: number; y: number },
    w: number,
    d: number,
    z: { x: number; y: number; width: number; depth: number },
  ) => p.x - w / 2 < z.x + z.width && p.x + w / 2 > z.x && p.y - d / 2 < z.y + z.depth && p.y + d / 2 > z.y;

  it("keeps a full plate clear of the purge corner", () => {
    const corner = { x: 0, y: 0, width: 18, depth: 28 };
    const p1s = { width: 256, depth: 256, exclude: [corner] };
    const placed = packPlates(
      Array.from({ length: 40 }, () => item(36, 11)),
      p1s,
    );
    expect(placed.every((p) => !overlaps(p, 36, 11, corner))).toBe(true);
  });

  it("keeps out of strips only one nozzle reaches", () => {
    const h2d = {
      width: 350,
      depth: 320,
      exclude: [
        { x: 0, y: 0, width: 25, depth: 320 },
        { x: 325, y: 0, width: 25, depth: 320 },
      ],
    };
    const placed = packPlates(
      Array.from({ length: 80 }, () => item(78, 11)),
      h2d,
    );
    expect(placed.every((p) => p.x - 39 >= 25 && p.x + 39 <= 325)).toBe(true);
    expect(tooLarge(item(300), h2d)).toBe(true);
    expect(tooLarge(item(285), h2d)).toBe(false);
  });

  it("still centres a small layout when that is clear", () => {
    const corner = { x: 0, y: 0, width: 18, depth: 28 };
    expect(packPlates([item(36, 11)], { width: 256, depth: 256, exclude: [corner] })).toEqual([
      { plate: 0, x: 128, y: 128 },
    ]);
  });
});

describe("plateOrigin", () => {
  it("matches Bambu Studio's grid of plates", () => {
    expect([1, 2, 3, 4, 5, 9, 10].map(plateColumns)).toEqual([1, 2, 2, 2, 3, 3, 4]);
    expect(plateOrigin(0, 3, bed)).toEqual([0, -0]);
    expect(plateOrigin(1, 3, bed)).toEqual([120, -0]);
    expect(plateOrigin(2, 3, bed)).toEqual([0, -72]);
  });
});

describe("bedOf", () => {
  const custom = { width: 256, depth: 256 };

  it("keeps the purge tower's spot clear only with more than one colour", () => {
    const h2s = { id: "bbl-h2s", custom };
    expect(bedOf(h2s, false).exclude ?? []).toEqual([]);
    expect(bedOf(h2s, true).exclude).toEqual([{ x: 165, y: 250, width: 66, depth: 66, kind: "tower" }]);
  });

  it("pulls the purge tower back onto a smaller plate", () => {
    const [tower] = bedOf({ id: "bbl-a1mini", custom }, true).exclude!;
    expect(tower).toEqual({ x: 0, y: 139, width: 41, depth: 41, kind: "tower" });
  });

  it("keeps labels off the purge tower", () => {
    const bed = bedOf({ id: "bbl-h2s", custom }, true);
    const tower = bed.exclude![0];
    const placed = packPlates(
      Array.from({ length: 70 }, (_, i) => item([36, 78, 120][i % 3], 11)),
      bed,
    );
    for (const [i, p] of placed.entries()) {
      const w = [36, 78, 120][i % 3];
      const overlap =
        p.x - w / 2 < tower.x + tower.width &&
        p.x + w / 2 > tower.x &&
        p.y - 5.5 < tower.y + tower.depth &&
        p.y + 5.5 > tower.y;
      expect(overlap).toBe(false);
    }
  });
});
